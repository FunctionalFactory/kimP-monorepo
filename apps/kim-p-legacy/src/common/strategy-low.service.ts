// src/common/strategy-low.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ArbitrageRecordService } from '../db/arbitrage-record.service';
import { ExchangeService, ExchangeType } from './exchange.service';
import { Order, OrderSide } from './exchange.interface';
import { ConfigService } from '@nestjs/config'; // ⭐️ ConfigService import 추가
import axios from 'axios';
import { TelegramService } from './telegram.service';
import { WithdrawalConstraintService } from './withdrawal-constraint.service';

// 유틸리티 함수: 지정된 시간(ms)만큼 대기
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class StrategyLowService {
  private readonly logger = new Logger(StrategyLowService.name);

  // 폴링 관련 설정
  private readonly POLLING_INTERVAL_MS = 3000; // 3초
  private readonly DEPOSIT_TIMEOUT_MS = 600000; // 10분

  private readonly ORDER_RETRY_LIMIT = 3; // 최대 재주문 횟수
  private readonly ORDER_POLL_TIMEOUT_MS = 30000; // 각 주문의 폴링 타임아웃 (30초)
  private readonly PRICE_ADJUSTMENT_FACTOR = 0.0005; // 가격 조정 비율 (0.05%)

  constructor(
    private readonly exchangeService: ExchangeService,
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService, // TelegramService 주입
    private readonly withdrawalConstraintService: WithdrawalConstraintService,
  ) {}

  async handleLowPremiumFlow(
    symbol: string,
    upbitPrice: number,
    binancePrice: number,
    rate: number,
    cycleId: string,
    investmentKRW: number,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`[STRATEGY_LOW] Starting REAL trade for cycle ${cycleId}`);

    let shortPositionAmount = 0;
    let transferredToFutures = false; // 🔥 추가: 선물로 이체했는지 추적
    let transferAmount = 0; // 추가: 이체한 금액 추적
    let withdrawalCompleted = false; // 송금 완료 여부 추적
    let withdrawalTxId: string | null = null; // 송금 트랜잭션 ID

    try {
      this.logger.log(
        `[STRATEGY_LOW] 사전 점검: 업비트에서 사용 가능한 KRW 잔고를 확인합니다...`,
      );

      const upbitBalances = await this.exchangeService.getBalances('upbit');
      const krwBalance =
        upbitBalances.find((b) => b.currency === 'KRW')?.available || 0;

      const safeInvestmentKRW = Number(investmentKRW);

      if (krwBalance < safeInvestmentKRW) {
        const requiredAmount =
          typeof safeInvestmentKRW === 'number'
            ? safeInvestmentKRW.toFixed(0)
            : '0';
        const currentBalance =
          typeof krwBalance === 'number' ? krwBalance.toFixed(0) : '0';
        throw new Error(
          `업비트 KRW 잔고 부족. 필요 금액: ${requiredAmount}, 현재 잔고: ${currentBalance}`,
        );
      }
      this.logger.log(`[STRATEGY_LOW] 잔고 확인 완료. 거래를 계속합니다.`);

      // 0. 사전 안전 점검
      const upbitWalletStatus = await this.exchangeService.getWalletStatus(
        'upbit',
        symbol,
      );
      if (!upbitWalletStatus.canWithdraw) {
        throw new Error(`Upbit wallet for ${symbol} has withdrawal disabled.`);
      }
      const binanceWalletStatus = await this.exchangeService.getWalletStatus(
        'binance',
        symbol,
      );
      if (!binanceWalletStatus.canDeposit) {
        throw new Error(`Binance wallet for ${symbol} has deposit disabled.`);
      }
      this.logger.log(`[STRATEGY_LOW] Wallet status check OK for ${symbol}`);

      this.logger.log(
        `[STRATEGY_LOW] 업비트 호가창을 확인하여 최적 주문 가격을 결정합니다...`,
      );

      const upbitOrderBook = await this.exchangeService.getOrderBook(
        'upbit',
        symbol,
      );

      if (
        !upbitOrderBook ||
        !upbitOrderBook.asks ||
        upbitOrderBook.asks.length === 0
      ) {
        throw new Error(`업비트 호가창 데이터를 가져올 수 없습니다: ${symbol}`);
      }

      // 1. 업비트 매수
      const buyAmount = investmentKRW / upbitPrice;

      const optimalOrderPrice = this.calculateOptimalBuyPrice(
        upbitOrderBook.asks,
        buyAmount,
        upbitPrice,
      );

      this.logger.log(
        `[STRATEGY_LOW] 호가창 기반 주문 가격 결정: 현재가 ${upbitPrice} -> 최적가 ${optimalOrderPrice} KRW`,
      );

      const buyOrder = await this.exchangeService.createOrder(
        'upbit',
        symbol,
        'limit',
        'buy',
        buyAmount,
        optimalOrderPrice,
      );

      const upbitMode = this.configService.get('UPBIT_MODE');
      let filledBuyOrder: Order;

      if (upbitMode === 'SIMULATION') {
        this.logger.log('[SIMULATION] Skipping Upbit buy order polling.');
        filledBuyOrder = buyOrder;
      } else {
        filledBuyOrder = await this.pollOrderStatus(
          cycleId,
          'upbit',
          buyOrder.id,
          symbol,
          upbitPrice,
          'buy',
          buyAmount,
        );
      }

      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'LP_BOUGHT',
        lowPremiumBuyTxId: filledBuyOrder.id,
      });
      this.logger.log(`[STRATEGY_LOW] Upbit buy order for ${symbol} filled.`);

      try {
        const requiredMarginUSDT =
          filledBuyOrder.filledAmount * binancePrice * 1.1;
        transferAmount = requiredMarginUSDT;

        this.logger.log(
          `[HEDGE_LP] 숏 포지션 증거금 확보를 위해 현물 지갑에서 선물 지갑으로 ${requiredMarginUSDT.toFixed(2)} USDT 이체를 시도합니다.`,
        );
        const binanceBalances =
          await this.exchangeService.getBalances('binance');
        const spotUsdtBalance =
          binanceBalances.find((b) => b.currency === 'USDT')?.available || 0;
        if (spotUsdtBalance < requiredMarginUSDT) {
          const shortageAmount = requiredMarginUSDT - spotUsdtBalance;
          this.logger.warn(
            `[HEDGE_LP] 현물 USDT 부족. 선물에서 ${shortageAmount.toFixed(2)} USDT를 가져옵니다...`,
          );

          // 선물 → 현물로 부족한 만큼 이체
          await this.exchangeService.internalTransfer(
            'binance',
            'USDT',
            shortageAmount,
            'UMFUTURE', // From: 선물 지갑
            'SPOT', // To: 현물 지갑
          );
          await delay(2000); // 이체 후 반영될 때까지 잠시 대기
          this.logger.log(`[HEDGE_LP] 선물에서 현물로 USDT 이체 완료.`);
        }

        // internalTransfer 함수를 사용하여 자산 이체
        await this.exchangeService.internalTransfer(
          'binance',
          'USDT',
          requiredMarginUSDT,
          'SPOT', // From: 현물(Spot) 지갑
          'UMFUTURE', // To: 선물(USDⓈ-M Futures) 지갑
        );
        transferredToFutures = true; // 이체 완료 표시
        await delay(5000); // 이체 후 반영될 때까지 잠시 대기

        this.logger.log(`[HEDGE_LP] 선물 지갑 잔고 확인 중...`);
        const futuresBalances = await this.exchangeService.getFuturesBalances(
          'binance',
          'UMFUTURE',
        );
        const futuresUsdtBalance =
          futuresBalances.find((b) => b.currency === 'USDT')?.available || 0;
        this.logger.log(
          `[HEDGE_LP] 선물 지갑 USDT 잔고: ${futuresUsdtBalance.toFixed(2)}`,
        );

        if (futuresUsdtBalance < requiredMarginUSDT * 0.95) {
          // 95% 이상이면 허용
          throw new Error(
            `선물 지갑 USDT 부족: 필요 ${requiredMarginUSDT.toFixed(2)}, 보유 ${futuresUsdtBalance.toFixed(2)}`,
          );
        }

        this.logger.log(
          `[HEDGE_LP] 증거금 이체 완료. ${symbol} 1x 숏 포지션 진입을 시작합니다...`,
        );
        shortPositionAmount = filledBuyOrder.filledAmount; // 헷지할 수량 기록

        const shortOrder = await this.exchangeService.createFuturesOrder(
          'binance',
          symbol,
          'sell', // 숏 포지션 진입
          'market',
          shortPositionAmount,
        );

        this.logger.log(
          `[HEDGE_LP] 숏 포지션 진입 성공. TxID: ${shortOrder.id}`,
        );
        await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
          lp_short_entry_tx_id: shortOrder.id, // DB에 기록
        });
      } catch (hedgeError) {
        this.logger.error(
          `[HEDGE_LP_FAIL] 선물 증거금 이체에 실패했습니다: ${hedgeError.message}`,
        );
        await this.telegramService.sendMessage(
          `🚨 [긴급_LP] 사이클 ${cycleId}의 선물 증거금 이체 실패! 확인 필요!`,
        );
        // 증거금 확보 실패는 심각한 문제이므로 사이클 중단
        // 하지만 헷징 없이도 현물 거래는 가능하므로 경고만 하고 계속 진행
        this.logger.warn(
          `[HEDGE_LP_FAIL] 헷징 없이 현물 거래를 계속 진행합니다. 가격 변동 리스크가 있습니다.`,
        );

        // 헷징 실패 정보를 DB에 기록
        await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
          errorDetails: `Hedging failed: ${hedgeError.message}. Continuing without hedge.`,
        });
      }

      // 2. 바이낸스로 출금
      const { address: binanceAddress, tag: binanceTag } =
        await this.exchangeService.getDepositAddress('binance', symbol);

      const { net_type: upbitNetType } =
        await this.exchangeService.getDepositAddress('upbit', symbol);

      // 🔥 추가: 실제 업비트 지갑 잔고 확인
      let actualCoinBalance = 0;
      try {
        const upbitBalances = await this.exchangeService.getBalances('upbit');
        actualCoinBalance =
          upbitBalances.find((b) => b.currency === symbol.toUpperCase())
            ?.available || 0;

        this.logger.log(
          `[STRATEGY_LOW] 실제 업비트 ${symbol.toUpperCase()} 잔고: ${actualCoinBalance}`,
        );
      } catch (balanceError) {
        this.logger.error(
          `[STRATEGY_LOW] 업비트 잔고 조회 실패: ${balanceError.message}`,
        );
        throw new Error(`업비트 잔고 조회 실패: ${balanceError.message}`);
      }

      // 업비트 출금 수수료 조회 추가
      const withdrawalChance = await this.exchangeService.getWithdrawalChance(
        'upbit',
        symbol,
      );
      const withdrawalFee = withdrawalChance.fee;

      const amountToWithdraw = Math.min(
        filledBuyOrder.filledAmount,
        actualCoinBalance - withdrawalFee,
      );

      if (amountToWithdraw <= 0) {
        throw new Error(
          `업비트에서 ${symbol.toUpperCase()} 출금 가능한 잔고가 없습니다. (실제 잔고: ${actualCoinBalance})`,
        );
      }

      const adjustedAmountToWithdraw =
        this.withdrawalConstraintService.adjustWithdrawalAmount(
          symbol,
          amountToWithdraw,
        );

      this.logger.log(
        `[STRATEGY_LOW] 출금 수량 조정: ${amountToWithdraw} → ${adjustedAmountToWithdraw} ${symbol}`,
      );

      // 조정 후 최종 확인
      if (adjustedAmountToWithdraw > actualCoinBalance) {
        throw new Error(
          `조정된 출금 수량(${adjustedAmountToWithdraw})이 실제 잔고(${actualCoinBalance})를 초과합니다.`,
        );
      }

      const withdrawalResult = await this.exchangeService.withdraw(
        'upbit',
        symbol,
        binanceAddress,
        adjustedAmountToWithdraw.toString(),
        binanceTag,
        upbitNetType,
      );

      withdrawalTxId = withdrawalResult.id; // 송금 트랜잭션 ID 저장
      withdrawalCompleted = true; // 송금 완료 표시

      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'LP_WITHDRAWN',
        lowPremiumWithdrawTxId: withdrawalResult.id,
      });
      this.logger.log(
        `[STRATEGY_LOW] Withdrawal from Upbit to Binance initiated.`,
      );

      // 3. 바이낸스 입금 확인
      const binanceMode = this.configService.get('BINANCE_MODE');
      if (binanceMode === 'SIMULATION') {
        this.logger.log(
          '[SIMULATION] Skipping Binance deposit confirmation polling.',
        );
        await delay(2000); // 시뮬레이션 모드에서는 가상 딜레이만 줌
      } else {
        await this.pollDepositConfirmation(
          cycleId,
          'binance',
          symbol,
          filledBuyOrder.filledAmount,
        );
      }
      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'LP_DEPOSITED',
      });
      this.logger.log(`[STRATEGY_LOW] Deposit to Binance confirmed.`);

      // 4. 바이낸스 매도
      const sellAmount = filledBuyOrder.filledAmount; // 판매할 수량
      const filledSellOrder = await this.aggressiveSellOnBinance(
        cycleId,
        symbol,
        sellAmount,
      );

      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'LP_SOLD',
      });
      this.logger.log(
        `[STRATEGY_LOW] Binance sell order for ${symbol} filled.`,
      );

      try {
        this.logger.log(
          `[HEDGE_LP] 현물 매도 완료. ${symbol} 숏 포지션 종료를 시작합니다...`,
        );

        const closeShortOrder = await this.exchangeService.createFuturesOrder(
          'binance',
          symbol,
          'buy', // 숏 포지션 종료는 'BUY'
          'market',
          shortPositionAmount, // 진입했던 수량 그대로 청산
        );

        this.logger.log(
          `[HEDGE_LP] 숏 포지션 종료 성공. TxID: ${closeShortOrder.id}`,
        );
        if (transferredToFutures) {
          await this.returnFundsToSpot(cycleId, transferAmount);
        }
        await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
          lp_short_close_tx_id: closeShortOrder.id, // DB에 기록
        });
      } catch (hedgeError) {
        if (transferredToFutures) {
          await this.returnFundsToSpot(cycleId, transferAmount, true);
        }
        await this.handleLowPremiumError(
          cycleId,
          symbol,
          hedgeError as Error,
          withdrawalCompleted,
          withdrawalTxId,
        );
        return;
      }

      // 5. 최종 사이클 결과 계산 및 DB 업데이트
      const existingCycle =
        await this.arbitrageRecordService.getArbitrageCycle(cycleId);
      if (!existingCycle)
        throw new Error('Could not find cycle data for final calculation.');

      const highPremiumProfit = Number(
        existingCycle.highPremiumNetProfitKrw || 0,
      );
      const lowPremiumSellUsd =
        filledSellOrder.filledAmount * filledSellOrder.price -
        (filledSellOrder.fee.cost || 0);
      const lowPremiumNetProfitKrw = lowPremiumSellUsd * rate - investmentKRW; // TODO: 전송 수수료 추가 계산 필요
      const totalNetProfitKrw = highPremiumProfit + lowPremiumNetProfitKrw;
      const totalInvestmentKrw = Number(existingCycle.initialInvestmentKrw);
      // Infinity 방지를 위한 안전한 수익률 계산
      let totalNetProfitPercent = 0;
      if (totalInvestmentKrw !== 0 && totalInvestmentKrw > 0) {
        const rawPercent = (totalNetProfitKrw / totalInvestmentKrw) * 100; // Infinity, -Infinity, NaN 체크
        if (isFinite(rawPercent)) {
          // 소수점 4자리로 제한 (버림)
          totalNetProfitPercent = Math.floor(rawPercent * 10000) / 10000;
        } else {
          this.logger.warn(
            `[STRATEGY_LOW] Invalid total profit percentage calculated: ${rawPercent}, using 0`,
          );
          totalNetProfitPercent = 0;
        }
      }

      const totalNetProfitUsd = isFinite(totalNetProfitKrw / rate)
        ? totalNetProfitKrw / rate
        : 0;
      const lowPremiumNetProfitUsd = isFinite(lowPremiumNetProfitKrw / rate)
        ? lowPremiumNetProfitKrw / rate
        : 0;

      // 모든 값이 유효한지 최종 검증
      const safeTotalNetProfitKrw = isFinite(totalNetProfitKrw)
        ? totalNetProfitKrw
        : 0;
      const safeLowPremiumNetProfitKrw = isFinite(lowPremiumNetProfitKrw)
        ? lowPremiumNetProfitKrw
        : 0;

      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'COMPLETED',
        endTime: new Date(),
        lowPremiumSymbol: symbol,
        lowPremiumNetProfitKrw: safeLowPremiumNetProfitKrw,
        lowPremiumNetProfitUsd: lowPremiumNetProfitUsd,
        totalNetProfitKrw: safeTotalNetProfitKrw,
        totalNetProfitPercent,
        totalNetProfitUsd,
      });

      this.logger.log(`✅ [STRATEGY_LOW] Cycle ${cycleId} fully COMPLETED.`);
      this.logger.log(`📊 [STRATEGY_LOW] Final Results:`);
      this.logger.log(
        ` - High Premium Profit: ${highPremiumProfit.toFixed(0)} KRW`,
      );
      this.logger.log(
        ` - Low Premium Profit: ${safeLowPremiumNetProfitKrw.toFixed(0)} KRW`,
      );
      this.logger.log(
        ` - Total Profit: ${safeTotalNetProfitKrw.toFixed(0)} KRW (${totalNetProfitPercent.toFixed(2)}%)`,
      );
      this.logger.log(`✅ [STRATEGY_LOW] Cycle ${cycleId} fully COMPLETED.`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `[STRATEGY_LOW] Error in handleLowPremiumFlow: ${error.message}`,
      );

      if (transferredToFutures) {
        await this.returnFundsToSpot(cycleId, transferAmount, true);
      }

      await this.handleLowPremiumError(
        cycleId,
        symbol,
        error as Error,
        withdrawalCompleted,
        withdrawalTxId,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * 호가창을 기반으로 최적 매수 가격을 계산합니다.
   * @param asks 매도 호가 목록 (낮은 가격 순)
   * @param buyAmount 매수할 수량
   * @param currentPrice 현재 시장 가격
   * @returns 최적 주문 가격
   */
  private calculateOptimalBuyPrice(
    asks: { price: number; amount: number }[],
    buyAmount: number,
    currentPrice: number,
  ): number {
    // 호가창이 비어있으면 현재가 사용
    if (!asks || asks.length === 0) {
      this.logger.warn('[STRATEGY_LOW] 호가창이 비어있어 현재가를 사용합니다.');
      return currentPrice;
    }

    // 매수할 수량을 충족하는 최소 가격 찾기
    let cumulativeAmount = 0;
    let optimalPrice = currentPrice;

    for (const ask of asks) {
      cumulativeAmount += ask.amount;

      if (cumulativeAmount >= buyAmount) {
        // 충분한 수량을 확보할 수 있는 최저 가격
        optimalPrice = ask.price;
        break;
      }
    }

    // 최적 가격이 현재가보다 너무 높으면 현재가 사용
    const maxPriceIncrease = currentPrice * 0.005; // 최대 0.5% 상승 허용
    if (optimalPrice > currentPrice + maxPriceIncrease) {
      this.logger.warn(
        `[STRATEGY_LOW] 최적가(${optimalPrice})가 허용 범위를 초과하여 현재가(${currentPrice})를 사용합니다.`,
      );
      optimalPrice = currentPrice;
    }

    // 가격 정밀도 조정 (업비트는 보통 2자리 정밀도)
    const pricePrecision = 2;
    optimalPrice = parseFloat(optimalPrice.toFixed(pricePrecision));

    this.logger.log(
      `[STRATEGY_LOW] 최적 매수 가격 계산 완료: ${optimalPrice} KRW (현재가 대비 ${(((optimalPrice - currentPrice) / currentPrice) * 100).toFixed(3)}%)`,
    );

    return optimalPrice;
  }

  // 에러 처리 메서드 추가
  private async handleLowPremiumError(
    cycleId: string,
    symbol: string,
    error: Error,
    withdrawalCompleted: boolean,
    withdrawalTxId: string | null,
  ): Promise<void> {
    const errorMessage = error.message;

    if (withdrawalCompleted) {
      // 송금 완료 후 에러: 긴급 상황
      const urgentMessage =
        `🚨 *[긴급_LP]* 사이클 ${cycleId} 송금 후 에러 발생!\n` +
        `코인: ${symbol.toUpperCase()}\n` +
        `송금 TX ID: ${withdrawalTxId || 'N/A'}\n` +
        `에러: ${errorMessage}\n` +
        `⚠️ 수동 개입 필요!`;

      await this.telegramService.sendMessage(urgentMessage);

      // DB 상태를 FAILED로 업데이트
      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'FAILED',
        errorDetails: `Low Premium Leg Failed (After Withdrawal): ${errorMessage}`,
        endTime: new Date(),
      });

      this.logger.error(
        `[STRATEGY_LOW] CRITICAL ERROR after withdrawal during cycle ${cycleId}: ${errorMessage}`,
        error.stack,
      );
    } else {
      // 송금 전 에러: 재시도 가능
      const retryMessage =
        `⚠️ *[LP_재시도]* 사이클 ${cycleId} 송금 전 에러 발생\n` +
        `코인: ${symbol.toUpperCase()}\n` +
        `에러: ${errorMessage}\n` +
        `�� 자동 재탐색 시작`;

      await this.telegramService.sendMessage(retryMessage);
      // DB 상태를 AWAITING_LP로 유지 (재탐색 가능)
      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'AWAITING_LP',
        errorDetails: `Low Premium Leg Error (Before Withdrawal): ${errorMessage}`,
      });

      this.logger.warn(
        `[STRATEGY_LOW] Recoverable error before withdrawal during cycle ${cycleId}: ${errorMessage}`,
      );

      // 에러를 다시 던지지 않음 (재탐색을 위해)
      return;
    }
  }

  // �� 추가: 자금 반환 로직을 별도 메서드로 분리
  private async returnFundsToSpot(
    cycleId: string,
    amount: number,
    isErrorCase: boolean = false,
  ): Promise<void> {
    const context = isErrorCase ? '[ERROR_RETURN]' : '[HEDGE_LP]';
    try {
      const futuresBalances = await this.exchangeService.getFuturesBalances(
        'binance',
        'UMFUTURE',
      );
      const futuresUsdtBalance =
        futuresBalances.find((b) => b.currency === 'USDT')?.available || 0;

      this.logger.log(
        `${context} 선물 지갑 USDT 잔고: ${futuresUsdtBalance.toFixed(6)} USDT`,
      );

      const actualReturnAmount = Math.min(futuresUsdtBalance, amount);

      if (actualReturnAmount <= 0) {
        this.logger.warn(
          `${context} 선물 지갑에 반환할 USDT가 없습니다. (잔고: ${futuresUsdtBalance.toFixed(6)} USDT)`,
        );
        return;
      }

      this.logger.log(
        `${context} 선물 지갑에서 현물 지갑으로 ${actualReturnAmount.toFixed(6)} USDT를 반환합니다...`,
      );

      await this.exchangeService.internalTransfer(
        'binance',
        'USDT',
        actualReturnAmount,
        'UMFUTURE', // From: 선물 지갑
        'SPOT', // To: 현물 지갑
      );

      this.logger.log(`${context} 현물 지갑으로 자금 반환 완료.`);
      if (actualReturnAmount < amount) {
        const difference = amount - actualReturnAmount;
        this.logger.warn(
          `${context} 반환 금액이 요청 금액보다 적습니다. 차이: ${difference.toFixed(6)} USDT (수수료/가격변동)`,
        );
      }
    } catch (returnError) {
      this.logger.error(
        `${context} 현물 지갑으로 자금 반환 실패: ${returnError.message}`,
      );
      await this.telegramService.sendMessage(
        `⚠️ [자금 반환 실패] 사이클 ${cycleId}의 현물 지갑 자금 반환에 실패했습니다. 수동 확인 필요.`,
      );
    }
  }

  private async aggressiveSellOnBinance(
    cycleId: string,
    symbol: string,
    amountToSell: number,
  ): Promise<Order> {
    this.logger.log(
      `[AGGRESSIVE_SELL_BINANCE] ${amountToSell} ${symbol} 전량 매도를 시작합니다.`,
    );
    const market = `${symbol.toUpperCase()}USDT`;

    let lastOrderPrice = 0;

    while (true) {
      try {
        this.logger.verbose(
          `[AGGRESSIVE_SELL_BINANCE] 현재가 조회를 시도합니다...`,
        );
        const tickerResponse = await axios.get(
          `https://api.binance.com/api/v3/ticker/price?symbol=${market}`,
        );
        const currentPrice = parseFloat(tickerResponse.data.price);

        if (!currentPrice) {
          this.logger.warn(
            `[AGGRESSIVE_SELL_BINANCE] 현재가 조회 실패. 5초 후 재시도합니다.`,
          );
          await delay(5000);
          continue;
        }

        if (lastOrderPrice === currentPrice) {
          this.logger.log(
            `[AGGRESSIVE_SELL_BINANCE] 현재가(${currentPrice})가 마지막 주문가(${lastOrderPrice})와 동일합니다. 5초 후 재확인합니다.`,
          );
          await delay(5000);
          continue;
        }

        //매도 시도 전 실제 잔고 재확인
        const binanceBalances =
          await this.exchangeService.getBalances('binance');
        const actualBalance =
          binanceBalances.find((b) => b.currency === symbol.toUpperCase())
            ?.available || 0;

        this.logger.log(
          `[AGGRESSIVE_SELL_BINANCE] 실제 ${symbol} 잔고: ${actualBalance}, 매도 시도 수량: ${amountToSell}`,
        );

        const adjustedAmountToSell = Math.min(actualBalance, amountToSell);

        const symbolInfo = await this.exchangeService.getSymbolInfo(
          'binance',
          symbol,
        );
        const lotSizeFilter = symbolInfo.filters.find(
          (f: any) => f.filterType === 'LOT_SIZE',
        );
        const stepSize = lotSizeFilter.stepSize;

        // stepSize에 맞게 조정
        const precision = Math.max(stepSize.indexOf('1') - 1, 0);
        const stepAdjustedAmount = parseFloat(
          adjustedAmountToSell.toFixed(precision),
        );

        const finalAmount = Math.min(stepAdjustedAmount, actualBalance);

        if (finalAmount <= 0) {
          this.logger.warn(
            `[AGGRESSIVE_SELL_BINANCE] ${symbol} 잔고가 없습니다. 매도를 중단합니다.`,
          );
          throw new Error(`No ${symbol} balance available for selling.`);
        }

        if (adjustedAmountToSell < amountToSell) {
          this.logger.warn(
            `[AGGRESSIVE_SELL_BINANCE] 실제 잔고(${actualBalance})가 요청 수량(${amountToSell})보다 적습니다. 조정된 수량(${adjustedAmountToSell})으로 매도합니다.`,
          );
        }

        this.logger.log(
          `[AGGRESSIVE_SELL_BINANCE] 현재가: ${currentPrice} USDT. 지정가 매도를 시도합니다.`,
        );
        const sellOrder = await this.exchangeService.createOrder(
          'binance',
          symbol,
          'limit',
          'sell',
          finalAmount,
          currentPrice,
        );

        lastOrderPrice = currentPrice;

        const startTime = Date.now();
        while (Date.now() - startTime < 10000) {
          const orderStatus = await this.exchangeService.getOrder(
            'binance',
            sellOrder.id,
            symbol,
          );
          if (orderStatus.status === 'filled') {
            this.logger.log(
              `[AGGRESSIVE_SELL_BINANCE] 매도 성공! Order ID: ${orderStatus.id}, 체결 수량: ${orderStatus.filledAmount}`,
            );
            return orderStatus;
          }
          await delay(2000);
        }

        this.logger.log(
          `[AGGRESSIVE_SELL_BINANCE] 10초 내 미체결. 주문 취소 후 재시도. Order ID: ${sellOrder.id}`,
        );
        await this.exchangeService.cancelOrder('binance', sellOrder.id, symbol);
      } catch (error) {
        const errorMessage = error.message.toLowerCase();
        // 재시도가 무의미한 특정 에러 키워드들
        const fatalErrors = [
          'insufficient funds',
          'invalid access key',
          'minimum total',
          'no balance available',
          'insufficient balance',
        ];
        if (fatalErrors.some((keyword) => errorMessage.includes(keyword))) {
          this.logger.error(
            `[AGGRESSIVE_SELL_BINANCE] 치명적 오류 발생, 매도를 중단합니다: ${error.message}`,
          );
          // 여기서 에러를 다시 던져서 handleLowPremiumFlow의 메인 catch 블록으로 넘김
          throw error;
        }
        this.logger.error(
          `[AGGRESSIVE_SELL_BINANCE] 매도 시도 중 오류: ${error.message}. 5초 후 재시도합니다.`,
        );
      }
      await delay(5000);
    }
  }

  // 주문 체결 폴링 로직
  // 주문 체결 폴링 로직을 '호가 추적' 기능이 포함된 새 로직으로 교체
  private async pollOrderStatus(
    cycleId: string,
    exchange: ExchangeType,
    initialOrderId: string,
    symbol: string,
    initialPrice: number,
    side: OrderSide,
    amount: number,
  ): Promise<Order> {
    let currentOrderId = initialOrderId;
    let currentPrice = initialPrice;

    for (let attempt = 1; attempt <= this.ORDER_RETRY_LIMIT; attempt++) {
      const startTime = Date.now();
      this.logger.log(
        `[POLLING ATTEMPT #${attempt}] Start polling for order ${currentOrderId}. Price: ${currentPrice}`,
      );

      while (Date.now() - startTime < this.ORDER_POLL_TIMEOUT_MS) {
        try {
          const order = await this.exchangeService.getOrder(
            exchange,
            currentOrderId,
            symbol,
          );
          if (order.status === 'filled') {
            this.logger.log(
              `[POLLING] Order ${currentOrderId} filled on attempt #${attempt}.`,
            );
            return order;
          }
          if (order.status === 'canceled') {
            throw new Error(`Order ${currentOrderId} was canceled.`);
          }
          await delay(this.POLLING_INTERVAL_MS);
        } catch (e) {
          this.logger.warn(
            `[POLLING] Error polling order ${currentOrderId}: ${e.message}. Retrying...`,
          );
          await delay(this.POLLING_INTERVAL_MS);
        }
      }

      if (attempt < this.ORDER_RETRY_LIMIT) {
        this.logger.warn(
          `[RETRY] Order ${currentOrderId} timed out. Canceling and re-submitting...`,
        );
        try {
          await this.exchangeService.cancelOrder(
            exchange,
            currentOrderId,
            symbol,
          );
          currentPrice =
            side === 'buy'
              ? currentPrice * (1 + this.PRICE_ADJUSTMENT_FACTOR)
              : currentPrice * (1 - this.PRICE_ADJUSTMENT_FACTOR);

          const newOrder = await this.exchangeService.createOrder(
            exchange,
            symbol,
            'limit',
            side,
            amount,
            currentPrice,
          );
          currentOrderId = newOrder.id;
          this.logger.log(
            `[RETRY] New order ${currentOrderId} placed at new price ${currentPrice}.`,
          );
        } catch (error) {
          this.logger.error(
            `[RETRY] Failed to cancel or re-submit order: ${error.message}`,
          );
          throw error;
        }
      }
    }

    this.logger.error(
      `[FINAL TIMEOUT] Order failed to fill after ${this.ORDER_RETRY_LIMIT} attempts. Canceling final order ${currentOrderId}.`,
    );
    try {
      await this.exchangeService.cancelOrder(exchange, currentOrderId, symbol);
    } catch (finalCancelError) {
      this.logger.error(
        `[FINAL TIMEOUT] CRITICAL: Failed to cancel final order ${currentOrderId}: ${finalCancelError.message}`,
      );
    }

    throw new Error(`Order for ${symbol} failed to fill after all retries.`);
  }

  private async checkRealTimeBalance(
    exchange: ExchangeType,
    symbol: string,
  ): Promise<number> {
    try {
      const balances = await this.exchangeService.getBalances(exchange);
      const balance =
        balances.find((b) => b.currency.toUpperCase() === symbol.toUpperCase())
          ?.available || 0;

      this.logger.log(
        `[REAL_TIME_BALANCE] ${exchange} ${symbol} balance: ${balance}`,
      );

      return balance;
    } catch (error) {
      this.logger.error(
        `[REAL_TIME_BALANCE] Error checking ${exchange} ${symbol} balance: ${error.message}`,
      );
      throw error;
    }
  }

  // 입금 확인 폴링 로직
  private async pollDepositConfirmation(
    cycleId: string,
    exchange: ExchangeType,
    symbol: string,
    expectedAmount: number,
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log(
      `[POLLING] Start polling for deposit of ${expectedAmount} ${symbol} on ${exchange}. Timeout: ${this.DEPOSIT_TIMEOUT_MS}ms`,
    );

    const initialBalance = await this.checkRealTimeBalance(exchange, symbol);
    this.logger.log(`[POLLING] Initial ${symbol} balance: ${initialBalance}`);

    const checkInterval = 5000; // 5초마다 체크
    let checkCount = 0;

    while (Date.now() - startTime < this.DEPOSIT_TIMEOUT_MS) {
      try {
        checkCount++;
        // 1. 잔고 변화 확인
        const currentBalance = await this.checkRealTimeBalance(
          exchange,
          symbol,
        );
        const actualIncrease = currentBalance - initialBalance;
        const depositPercentage = (actualIncrease / expectedAmount) * 100;

        this.logger.log(
          `[POLLING] Check #${checkCount}: Current ${symbol} balance: ${currentBalance}, Actual increase: ${actualIncrease}, Percentage: ${depositPercentage.toFixed(2)}%`,
        );

        // 2. 50% 이상일 때 입금 내역으로 입금 여부 확인
        if (depositPercentage >= 50) {
          try {
            const depositHistory = await this.exchangeService.getDepositHistory(
              exchange,
              symbol,
              new Date(startTime), // 폴링 시작 시간 이후
              new Date(),
            );

            const recentDeposits = depositHistory.filter(
              (deposit) => deposit.status === 'COMPLETED' && deposit.amount > 0,
            );

            if (recentDeposits.length > 0) {
              const totalDeposited = recentDeposits.reduce(
                (sum, deposit) => sum + deposit.amount,
                0,
              );

              this.logger.log(
                `[POLLING] ✅ Deposit confirmed via history! Found ${recentDeposits.length} deposits, Total: ${totalDeposited.toFixed(8)} ${symbol} (${((totalDeposited / expectedAmount) * 100).toFixed(2)}%)`,
              );

              // 입금 내역 상세 로깅
              recentDeposits.forEach((deposit, index) => {
                this.logger.log(
                  `[POLLING] Deposit #${index + 1}: ${deposit.amount.toFixed(8)} ${symbol} at ${deposit.timestamp.toISOString()} (TX: ${deposit.txId?.substring(0, 16)}...)`,
                );
              });

              await this.telegramService.sendMessage(
                `📥 [입금 확인] ${symbol} 입금 완료!\n` +
                  `- 입금 건수: ${recentDeposits.length}건\n` +
                  `- 총 입금: ${totalDeposited.toFixed(8)} ${symbol}\n` +
                  `- 현재 잔액: ${currentBalance.toFixed(8)} ${symbol}`,
              );

              return; // 입금 확인 완료, 기존 방식대로 진행
            }
          } catch (historyError) {
            this.logger.warn(
              `[POLLING] 입금 내역 조회 실패, 잔고 변화로 판단: ${historyError.message}`,
            );
            // 입금 내역 조회 실패 시 잔고 변화로 판단
            await this.telegramService.sendMessage(
              `⚠️ [입금 확인] ${symbol} 입금 내역 조회 실패, 잔고 변화로 판단합니다.\n` +
                `- 증가량: ${actualIncrease.toFixed(8)} ${symbol} (${depositPercentage.toFixed(2)}%)\n` +
                `- 현재 잔액: ${currentBalance.toFixed(8)} ${symbol}`,
            );
            return; // 잔고 변화로 입금 확인
          }
        }

        await delay(checkInterval);
      } catch (error) {
        this.logger.warn(
          `[POLLING] Error checking balance (attempt #${checkCount}): ${error.message}. Retrying...`,
        );
        await delay(checkInterval);
      }
    }
    throw new Error(
      `Polling for deposit of ${symbol} timed out after ${this.DEPOSIT_TIMEOUT_MS}ms.`,
    );
  }
}
