// src/common/strategy-high.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ArbitrageRecordService } from '../db/arbitrage-record.service';
import { ExchangeService, ExchangeType } from './exchange.service';
import { Order, OrderSide } from './exchange.interface';
import { ConfigService } from '@nestjs/config'; // ⭐️ ConfigService import 추가
import axios from 'axios';
import { BinanceService } from 'src/binance/binance.service'; // ◀️ import 추가
import { TelegramService } from './telegram.service';
import { WithdrawalConstraintService } from './withdrawal-constraint.service';
import {
  ErrorHandlerService,
  ErrorSeverity,
  ErrorCategory,
} from './error-handler.service';

// 유틸리티 함수: 지정된 시간(ms)만큼 대기
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class StrategyHighService {
  private readonly logger = new Logger(StrategyHighService.name);

  // 폴링 관련 설정 (나중에 .env로 옮기는 것을 추천)
  private readonly POLLING_INTERVAL_MS = 3000; // 3초
  private readonly DEPOSIT_TIMEOUT_MS = 600000; // 10분
  private readonly ORDER_RETRY_LIMIT = 3; // 최대 재주문 횟수
  private readonly ORDER_POLL_TIMEOUT_MS = 30000; // 각 주문의 폴링 타임아웃 (30초)
  private readonly PRICE_ADJUSTMENT_FACTOR = 0.0005; // 가격 조정 비율 (0.05%)

  constructor(
    private readonly exchangeService: ExchangeService,
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly configService: ConfigService,
    private readonly binanceService: BinanceService, // ◀️ 주입 추가
    private readonly telegramService: TelegramService, // TelegramService 주입 추가
    private readonly withdrawalConstraintService: WithdrawalConstraintService,
    private readonly errorHandlerService: ErrorHandlerService,
  ) {}

  async handleHighPremiumFlow(
    symbol: string,
    upbitPrice: number,
    binancePrice: number,
    rate: number,
    cycleId: string,
    actualInvestmentUSDT: number,
  ): Promise<void> {
    this.logger.log(
      `[STRATEGY_HIGH] Starting trade process for cycle ${cycleId}`,
    );

    let shortPositionAmount = 0;
    let transferredToFutures = false; // �� 추가: 선물로 이체했는지 추적
    let transferAmount = 0; // 🔥 추가: 이체한 금액 추적

    try {
      // 0. 사전 안전 점검
      const binanceWalletStatus = await this.exchangeService.getWalletStatus(
        'binance',
        symbol,
      );
      if (!binanceWalletStatus.canWithdraw) {
        throw new Error(
          `Binance wallet for ${symbol} has withdrawal disabled.`,
        );
      }
      const upbitWalletStatus = await this.exchangeService.getWalletStatus(
        'upbit',
        symbol,
      );
      if (!upbitWalletStatus.canDeposit) {
        throw new Error(`Upbit wallet for ${symbol} has deposit disabled.`);
      }
      this.logger.log(`[STRATEGY_HIGH] Wallet status check OK for ${symbol}`);

      // 1. 바이낸스 매수 전, 현물 지갑 잔고 확인
      let binanceBalances = await this.exchangeService.getBalances('binance');
      const usdtBalance =
        binanceBalances.find((b) => b.currency === 'USDT')?.available || 0;

      // 매수하려는 금액(actualInvestmentUSDT)보다 현물 지갑 잔고가 부족할 경우
      if (usdtBalance < actualInvestmentUSDT) {
        const amountToTransfer = actualInvestmentUSDT - usdtBalance;
        this.logger.warn(
          `[STRATEGY_HIGH] 현물 지갑 USDT 부족. 선물 지갑에서 ${amountToTransfer} USDT를 가져옵니다...`,
        );
        // 선물 -> 현물로 부족한 만큼 이체
        await this.exchangeService.internalTransfer(
          'binance',
          'USDT',
          amountToTransfer,
          'UMFUTURE',
          'SPOT',
        );
        // 잠시 대기 후 로직 계속
        await delay(2000);
      }

      // 1. 바이낸스 매수 - 호가창 기반 주문 가격 결정
      this.logger.log(
        `[STRATEGY_HIGH] 호가창을 확인하여 최적 주문 가격을 결정합니다...`,
      );

      // 바이낸스 호가창 조회
      const binanceOrderBook = await this.exchangeService.getOrderBook(
        'binance',
        symbol,
      );

      if (
        !binanceOrderBook ||
        !binanceOrderBook.asks ||
        binanceOrderBook.asks.length === 0
      ) {
        throw new Error(
          `바이낸스 호가창 데이터를 가져올 수 없습니다: ${symbol}`,
        );
      }

      // 1. 바이낸스 매수
      // TODO: getOrderBook으로 호가창 확인 후, 지정가(limit)로 주문 가격 결정
      const exchangeTickerForInfo =
        this.binanceService.getExchangeTicker(symbol);
      const market = `${exchangeTickerForInfo}USDT`;

      // 바이낸스 거래 규칙(Exchange Info) 조회
      this.logger.log(
        `[STRATEGY_HIGH] 바이낸스 거래 규칙(stepSize) 조회를 위해 exchangeInfo를 호출합니다: ${market}`,
      );
      const exchangeInfoRes = await axios.get(
        'https://api.binance.com/api/v3/exchangeInfo',
      );
      const symbolInfo = exchangeInfoRes.data.symbols.find(
        (s: any) => s.symbol === market,
      );

      if (!symbolInfo) {
        throw new Error(`Could not find exchange info for symbol ${market}`);
      }

      const lotSizeFilter = symbolInfo.filters.find(
        (f: any) => f.filterType === 'LOT_SIZE',
      );

      if (!lotSizeFilter) {
        throw new Error(`Could not find LOT_SIZE filter for ${market}`);
      }

      // 규칙에서 quoteAsset(USDT)의 허용 정밀도(소수점 자릿수)를 가져옵니다.
      const quotePrecision = symbolInfo.quoteAssetPrecision;

      // 투자할 총액(USDT)을 허용된 정밀도에 맞게 조정합니다.
      const adjustedInvestmentUSDT = parseFloat(
        actualInvestmentUSDT.toFixed(quotePrecision),
      );

      const buyAmount = adjustedInvestmentUSDT / binancePrice;

      // stepSize에 맞춰 수량 정밀도 조정
      const stepSize = parseFloat(lotSizeFilter.stepSize);
      const adjustedBuyAmount = Math.floor(buyAmount / stepSize) * stepSize;

      this.logger.log(
        `[STRATEGY_HIGH] 수량 정밀도 조정: Raw: ${buyAmount} -> Adjusted: ${adjustedBuyAmount}`,
      );

      if (adjustedBuyAmount <= 0) {
        throw new Error(
          `조정된 매수 수량(${adjustedBuyAmount})이 0보다 작거나 같아 주문할 수 없습니다.`,
        );
      }

      // 호가창 기반 최적 주문 가격 결정
      const optimalOrderPrice = this.calculateOptimalBuyPrice(
        binanceOrderBook.asks,
        adjustedBuyAmount,
        binancePrice,
      );

      this.logger.log(
        `[STRATEGY_HIGH] 호가창 기반 주문 가격 결정: 현재가 ${binancePrice} -> 최적가 ${optimalOrderPrice} USDT`,
      );

      this.logger.log(
        `[STRATEGY_HIGH] Placing LIMIT buy order for ${adjustedBuyAmount} ${symbol} at ${optimalOrderPrice} USDT`,
      );

      const buyOrder = await this.exchangeService.createOrder(
        'binance',
        symbol,
        'limit',
        'buy',
        adjustedBuyAmount,
        optimalOrderPrice,
      );

      const binanceMode = this.configService.get('BINANCE_MODE');
      let filledBuyOrder: Order;

      if (binanceMode === 'SIMULATION') {
        this.logger.log('[SIMULATION] Skipping Binance buy order polling.');
        filledBuyOrder = buyOrder;
      } else {
        filledBuyOrder = await this.pollOrderStatus(
          cycleId,
          'binance',
          buyOrder.id,
          symbol,
          binancePrice, // 초기 가격 전달
          'buy', // 주문 방향 전달
          adjustedBuyAmount, // 재주문 시 사용할 수량 전달
        );
      }

      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'HP_BOUGHT',
        highPremiumBuyTxId: filledBuyOrder.id,
      });
      this.logger.log(
        `[STRATEGY_HIGH] Binance buy order for ${symbol} filled.`,
      );

      try {
        const requiredMarginUSDT = filledBuyOrder.filledAmount * binancePrice;
        transferAmount = requiredMarginUSDT; // 🔥 이체 금액 기록

        this.logger.log(
          `[HEDGE_HP] 숏 포지션 증거금 확보를 위해 현물 지갑에서 선물 지갑으로 ${requiredMarginUSDT.toFixed(2)} USDT 이체를 시도합니다.`,
        );

        // 🔥 추가: 현물 잔고 확인 및 선물에서 현물로 이체
        const binanceBalances =
          await this.exchangeService.getBalances('binance');
        const spotUsdtBalance =
          binanceBalances.find((b) => b.currency === 'USDT')?.available || 0;

        if (spotUsdtBalance < requiredMarginUSDT) {
          const shortageAmount = requiredMarginUSDT - spotUsdtBalance;
          this.logger.warn(
            `[HEDGE_HP] 현물 USDT 부족. 선물에서 ${shortageAmount.toFixed(2)} USDT를 가져옵니다...`,
          );

          // 현물 -> 선물로 증거금 이체
          await this.exchangeService.internalTransfer(
            'binance',
            'USDT',
            shortageAmount,
            'UMFUTURE', // From: 선물 지갑
            'SPOT', // To: 현물 지갑
          );

          await delay(2000); // 이체 후 반영될 때까지 잠시 대기
          this.logger.log(`[HEDGE_HP] 선물에서 현물로 USDT 이체 완료.`);
        }

        // 현물 -> 선물로 증거금 이체
        await this.exchangeService.internalTransfer(
          'binance',
          'USDT',
          requiredMarginUSDT,
          'SPOT', // From: 현물 지갑
          'UMFUTURE', // To: 선물 지갑
        );
        transferredToFutures = true; // 🔥 이체 완료 표시
        await delay(2000); // 이체 후 반영될 때까지 잠시 대기

        this.logger.log(
          `[HEDGE_HP] 증거금 이체 완료. ${symbol} 1x 숏 포지션 진입을 시작합니다...`,
        );
        shortPositionAmount = filledBuyOrder.filledAmount; // 헷지할 수량 기록

        const shortOrder = await this.exchangeService.createFuturesOrder(
          'binance',
          symbol,
          'sell', // 숏 포지션이므로 'SELL'
          'market', // 시장가로 즉시 진입
          shortPositionAmount,
        );

        this.logger.log(
          `[HEDGE_HP] 숏 포지션 진입 성공. TxID: ${shortOrder.id}`,
        );
        await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
          hp_short_entry_tx_id: shortOrder.id, // DB에 숏 포지션 주문 ID 기록
        });
      } catch (transferError) {
        await this.errorHandlerService.handleError({
          error: transferError as Error,
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.BUSINESS_LOGIC,
          context: {
            cycleId,
            symbol,
            exchange: 'BINANCE',
            operation: 'futures_transfer',
            stage: 'HIGH_PREMIUM',
          },
          recoverable: true,
        });

        // 헷징 없이 계속 진행
        this.logger.warn(
          `[HEDGE_HP_FAIL] 헷징 없이 현물 거래를 계속 진행합니다. 가격 변동 리스크가 있습니다.`,
        );
      }

      this.logger.log(
        `[STRATEGY_HIGH] 교차 검증: 매수 후 실제 바이낸스 잔고를 확인합니다...`,
      );
      // 바이낸스 내부 시스템에 잔고가 반영될 때까지 아주 잠시(1~2초) 기다려줍니다.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      binanceBalances = await this.exchangeService.getBalances('binance');
      const coinBalance =
        binanceBalances.find((b) => b.currency === symbol.toUpperCase())
          ?.available || 0;

      // API 응답의 체결 수량과 실제 지갑의 보유 수량이 거의 일치하는지 확인합니다. (네트워크 수수료 등 감안 99.9%)
      const successThreshold = 0.998; // 0.2%의 오차(수수료 등)를 허용
      if (coinBalance < filledBuyOrder.filledAmount * successThreshold) {
        throw new Error(
          `매수 후 잔고 불일치. API 응답상 체결 수량: ${filledBuyOrder.filledAmount}, 실제 지갑 보유 수량: ${coinBalance}`,
        );
      }
      this.logger.log(
        `[STRATEGY_HIGH] 잔고 확인 완료. 실제 보유 수량: ${coinBalance} ${symbol.toUpperCase()}`,
      );

      // 2. 업비트로 출금
      const { address: upbitAddress, tag: upbitTag } =
        await this.exchangeService.getDepositAddress('upbit', symbol);

      this.logger.log(
        `[STRATEGY_HIGH] 바이낸스에서 ${symbol.toUpperCase()} 출금 수수료를 조회합니다...`,
      );
      const withdrawalChance = await this.exchangeService.getWithdrawalChance(
        'binance',
        symbol,
      );
      const withdrawalFee = withdrawalChance.fee;
      this.logger.log(
        `[STRATEGY_HIGH] 조회된 출금 수수료: ${withdrawalFee} ${symbol.toUpperCase()}`,
      );

      const amountToWithdraw = coinBalance - withdrawalFee;

      if (amountToWithdraw <= 0) {
        throw new Error(
          `보유 잔고(${coinBalance})가 출금 수수료(${withdrawalFee})보다 작거나 같아 출금할 수 없습니다.`,
        );
      }

      // 출금 수량 또한 정밀도 조정이 필요할 수 있습니다. 여기서는 간단히 처리합니다.
      const adjustedAmountToWithdraw =
        this.withdrawalConstraintService.adjustWithdrawalAmount(
          symbol,
          amountToWithdraw,
        );
      this.logger.log(
        `[STRATEGY_HIGH] 출금 수량 조정: ${amountToWithdraw} → ${adjustedAmountToWithdraw} ${symbol}`,
      );

      // 조정으로 인한 손실이 있는 경우 로깅
      const lossFromAdjustment = amountToWithdraw - adjustedAmountToWithdraw;
      if (lossFromAdjustment > 0) {
        this.logger.warn(
          `[STRATEGY_HIGH] 출금 제약으로 인한 손실: ${lossFromAdjustment} ${symbol} (${((lossFromAdjustment / amountToWithdraw) * 100).toFixed(2)}%)`,
        );
      }

      // 실제 체결된 수량으로 출금 요청
      const withdrawalResult = await this.exchangeService.withdraw(
        'binance',
        symbol,
        upbitAddress,
        adjustedAmountToWithdraw.toString(),
        upbitTag,
      );
      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'HP_WITHDRAWN',
        highPremiumWithdrawTxId: withdrawalResult.id,
      });
      this.logger.log(
        `[STRATEGY_HIGH] Withdrawal from Binance to Upbit initiated.`,
      );

      // 3. 업비트 입금 확인
      const upbitMode = this.configService.get('UPBIT_MODE');
      let actualBalanceToSell: number;

      if (upbitMode === 'SIMULATION') {
        this.logger.log(
          '[SIMULATION] Skipping Upbit deposit confirmation polling.',
        );
        await delay(2000); // 시뮬레이션 모드에서는 가상 딜레이만 줌
        actualBalanceToSell = adjustedAmountToWithdraw; // 시뮬레이션에서는 예상 수량 사용
      } else {
        actualBalanceToSell = await this.pollDepositConfirmation(
          cycleId,
          'upbit',
          symbol,
          adjustedAmountToWithdraw,
        );
      }

      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'HP_DEPOSITED',
      });

      this.logger.log(
        `[STRATEGY_HIGH] Deposit to Upbit confirmed. Actual balance: ${actualBalanceToSell} ${symbol}`,
      );

      if (actualBalanceToSell <= 0) {
        throw new Error(
          `업비트에서 매도할 ${symbol} 잔고가 없습니다. (실제 잔액: ${actualBalanceToSell})`,
        );
      }

      this.logger.log(
        `[STRATEGY_HIGH] 실제 입금된 잔액으로 전량 매도 진행: ${actualBalanceToSell} ${symbol}`,
      );

      const filledSellOrder = await this.aggressiveSellOnUpbit(
        cycleId,
        symbol,
        actualBalanceToSell,
      );

      // <<<< 신규 추가: 업비트 현물 매도 성공 직후 헷지 숏 포지션 종료 >>>>
      try {
        this.logger.log(
          `[HEDGE] 현물 매도 완료. ${symbol} 숏 포지션 종료를 시작합니다...`,
        );

        const closeShortOrder = await this.exchangeService.createFuturesOrder(
          'binance',
          symbol,
          'buy', // 숏 포지션 종료는 'BUY'
          'market',
          shortPositionAmount, // 진입했던 수량 그대로 청산
        );

        this.logger.log(
          `[HEDGE] 숏 포지션 종료 성공. TxID: ${closeShortOrder.id}`,
        );
        await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
          hp_short_close_tx_id: closeShortOrder.id, // DB에 숏 포지션 종료 주문 ID 기록
        });

        if (transferredToFutures) {
          await this.returnFundsToSpot(cycleId, transferAmount);
        }
      } catch (hedgeError) {
        if (transferredToFutures) {
          await this.returnFundsToSpot(cycleId, transferAmount, true);
        }

        this.logger.error(
          `[HEDGE_FAIL] 숏 포지션 종료에 실패했습니다: ${hedgeError.message}`,
        );
        await this.telegramService.sendMessage(
          `[긴급] 사이클 ${cycleId}의 ${symbol} 숏 포지션 종료에 실패했습니다. 즉시 수동 청산 필요!`,
        );

        // 숏 포지션 종료 실패는 심각하지만 사이클은 완료된 상태
        // 수동 개입이 필요한 상황이므로 에러를 던지지 않고 로깅만
        this.logger.warn(
          `[HEDGE_FAIL] 사이클은 완료되었지만 숏 포지션 수동 청산이 필요합니다.`,
        );

        // 헷징 실패 정보를 DB에 기록
        await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
          errorDetails: `Short position close failed: ${hedgeError.message}. Manual intervention required.`,
        });
      }

      // 5. 최종 손익 계산 및 DB 업데이트
      const krwProceeds =
        filledSellOrder.filledAmount * filledSellOrder.price -
        (filledSellOrder.fee.cost || 0);
      const initialInvestmentKrw =
        filledBuyOrder.filledAmount * filledBuyOrder.price * rate +
        (filledBuyOrder.fee.cost || 0) * rate;
      const finalProfitKrw = krwProceeds - initialInvestmentKrw; // TODO: 전송 수수료 추가 계산 필요

      const safeFinalProfitKrw = isFinite(finalProfitKrw) ? finalProfitKrw : 0;
      const safeFilledSellPrice = isFinite(filledSellOrder.price)
        ? filledSellOrder.price
        : 0;
      const safeFilledBuyPrice = isFinite(filledBuyOrder.price)
        ? filledBuyOrder.price
        : 0;

      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'HP_SOLD',
        highPremiumNetProfitKrw: safeFinalProfitKrw,
        highPremiumUpbitSellPriceKrw: safeFilledSellPrice,
        highPremiumBinanceBuyPriceUsd: safeFilledBuyPrice,
        highPremiumCompletedAt: new Date(),
      });
      this.logger.log(
        `[STRATEGY_HIGH] Upbit sell order for ${symbol} filled. High premium leg completed.`,
      );
    } catch (error) {
      if (transferredToFutures) {
        await this.returnFundsToSpot(cycleId, transferAmount, true);
      }
      this.logger.error(
        `[STRATEGY_HIGH] CRITICAL ERROR during cycle ${cycleId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
        status: 'FAILED',
        errorDetails: `High Premium Leg Failed: ${(error as Error).message}`,
      });
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
      this.logger.warn(
        '[STRATEGY_HIGH] 호가창이 비어있어 현재가를 사용합니다.',
      );
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
        `[STRATEGY_HIGH] 최적가(${optimalPrice})가 허용 범위를 초과하여 현재가(${currentPrice})를 사용합니다.`,
      );
      optimalPrice = currentPrice;
    }

    // 가격 정밀도 조정 (바이낸스 규칙에 맞춤)
    const pricePrecision = 8; // 대부분의 코인은 8자리 정밀도
    optimalPrice = parseFloat(optimalPrice.toFixed(pricePrecision));

    this.logger.log(
      `[STRATEGY_HIGH] 최적 매수 가격 계산 완료: ${optimalPrice} USDT (현재가 대비 ${(((optimalPrice - currentPrice) / currentPrice) * 100).toFixed(3)}%)`,
    );

    return optimalPrice;
  }

  private async returnFundsToSpot(
    cycleId: string,
    amount: number,
    isErrorCase: boolean = false,
  ): Promise<void> {
    const context = isErrorCase ? '[ERROR_RETURN]' : '[HEDGE_HP]';

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

  /**
   * 주문이 체결될 때까지 주기적으로 상태를 확인합니다.
   */
  private async pollOrderStatus(
    cycleId: string,
    exchange: ExchangeType,
    initialOrderId: string,
    symbol: string,
    initialPrice: number, // ⭐️ 추적을 위해 초기 가격을 받습니다.
    side: OrderSide, // ⭐️ 매수/매도에 따라 가격 조정을 위해 side를 받습니다.
    amount: number, // ⭐️ 재주문 시 사용할 수량을 받습니다.
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
              `[POLLING] Order ${currentOrderId} filled on attempt ${attempt}.`,
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

      // --- 타임아웃 발생: 주문 취소 및 가격 조정 후 재주문 ---
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

          // 가격 조정: 매수는 가격을 올리고, 매도는 가격을 내림
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
          throw error; // 재시도 중 오류 발생 시 사이클 실패 처리
        }
      }
    }

    // 모든 지정가 재시도 실패 시, 에러를 던지는 대신 null을 반환하여 수동 개입을 유도
    this.logger.error(
      `[MANUAL_INTERVENTION_REQ] 지정가 주문이 ${this.ORDER_RETRY_LIMIT}회 모두 실패했습니다. (마지막 주문 ID: ${currentOrderId})`,
    );

    // 마지막 지정가 주문을 취소 시도
    try {
      await this.exchangeService.cancelOrder(exchange, currentOrderId, symbol);
      this.logger.log(`마지막 지정가 주문(${currentOrderId})을 취소했습니다.`);
    } catch (cancelError) {
      this.logger.warn(
        `최종 지정가 주문 취소 실패 (이미 체결되었거나 오류 발생): ${cancelError.message}`,
      );
    }

    // null을 반환하여 handleHighPremiumFlow에서 후속 처리를 하도록 함
    return null;
  }

  private async aggressiveSellOnUpbit(
    cycleId: string,
    symbol: string,
    amountToSell: number,
  ): Promise<Order> {
    this.logger.log(
      `[AGGRESSIVE_SELL] ${amountToSell} ${symbol} 전량 매도를 시작합니다.`,
    );
    const market = `KRW-${symbol.toUpperCase()}`;
    let currentOrderId: string | null = null;
    let lastOrderPrice: number | null = null;

    this.logger.log(
      `[AGGRESSIVE_SELL] 업비트에서 실제 입금된 ${amountToSell} ${symbol} 전량 매도 시작.`,
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // --- 1. 실제 잔고 확인 ---
        const upbitBalances = await this.exchangeService.getBalances('upbit');
        const actualBalance =
          upbitBalances.find((b) => b.currency === symbol.toUpperCase())
            ?.available || 0;

        this.logger.log(
          `[AGGRESSIVE_SELL] 실제 ${symbol} 잔고: ${actualBalance}, 초기 매도 요청 수량: ${amountToSell}`,
        );

        const adjustedAmountToSell = Math.min(actualBalance, amountToSell);

        // --- 2. 매도 완료 조건 확인 (핵심 수정) ---
        if (adjustedAmountToSell <= 0) {
          this.logger.log(
            `[AGGRESSIVE_SELL] 잔고가 0이므로, 매도가 성공적으로 완료된 것으로 간주합니다.`,
          );
          // 마지막 주문 ID가 있다면, 해당 주문의 최종 상태를 조회하여 반환 시도
          if (currentOrderId) {
            try {
              const finalOrder = await this.exchangeService.getOrder(
                'upbit',
                currentOrderId,
                symbol,
              );
              // 최종 주문 상태가 'filled'이면 성공적으로 반환
              if (finalOrder.status === 'filled') {
                this.logger.log(
                  `[AGGRESSIVE_SELL] 최종 확인된 체결 주문(${finalOrder.id}) 정보를 반환하고 매도를 종료합니다.`,
                );
                return finalOrder;
              }
            } catch (statusError) {
              // 조회가 실패하더라도, 잔고가 0이므로 더 이상 진행하는 것은 무의미함
              this.logger.error(
                `[AGGRESSIVE_SELL] 최종 주문(${currentOrderId}) 상태 확인에 실패했으나, 잔고가 0이므로 매도를 성공으로 간주하고 종료합니다. 오류: ${statusError.message}`,
              );
              // 이 경우, 더 이상 진행하면 안되므로 명시적인 에러를 발생시켜 사이클을 안전하게 중단
              throw new Error(
                `Selling completed (balance is zero), but failed to get final order status for ${currentOrderId}.`,
              );
            }
          }
          // 마지막 주문 ID가 없는데 잔고가 0인 경우. 이는 로직상 발생하기 어렵지만 안전장치로 추가
          this.logger.warn(
            `[AGGRESSIVE_SELL] 마지막 주문 ID가 없으나 잔고가 0입니다. 매도 프로세스를 안전하게 중단합니다.`,
          );
          throw new Error(
            'Selling seems completed (balance is zero), but no last order ID was tracked.',
          );
        }

        // --- 3. 현재가 조회 및 주문 취소/재주문 로직 (기존과 유사) ---
        const tickerResponse = await axios.get(
          `https://api.upbit.com/v1/ticker?markets=${market}`,
        );
        const currentPrice = tickerResponse.data[0]?.trade_price;

        if (!currentPrice) {
          this.logger.warn(
            `[AGGRESSIVE_SELL] 현재가 조회 실패. 5초 후 재시도합니다.`,
          );
          await delay(5000);
          continue;
        }

        if (currentOrderId && lastOrderPrice !== currentPrice) {
          this.logger.log(
            `[AGGRESSIVE_SELL] 가격 변동 감지: ${lastOrderPrice} → ${currentPrice}. 기존 주문(${currentOrderId}) 취소 후 재주문합니다.`,
          );
          try {
            await this.exchangeService.cancelOrder(
              'upbit',
              currentOrderId,
              symbol,
            );
          } catch (cancelError) {
            this.logger.warn(
              `[AGGRESSIVE_SELL] 주문 취소 실패 (이미 체결되었을 수 있음): ${cancelError.message}`,
            );
          }
          currentOrderId = null; // 주문 ID 리셋
        }

        // --- 4. 신규 주문 생성 ---
        if (!currentOrderId) {
          const adjustedAmountToSell = Math.min(actualBalance, amountToSell);

          this.logger.log(
            `[AGGRESSIVE_SELL] 현재가: ${currentPrice} KRW. 해당 가격으로 지정가 매도를 시도합니다. 수량: ${adjustedAmountToSell}`,
          );
          const sellOrder = await this.exchangeService.createOrder(
            'upbit',
            symbol,
            'limit',
            'sell',
            adjustedAmountToSell,
            currentPrice,
          );
          currentOrderId = sellOrder.id;
          lastOrderPrice = currentPrice;
          this.logger.log(
            `[AGGRESSIVE_SELL] 매도 주문 생성 완료. Order ID: ${currentOrderId}`,
          );
        }

        // --- 5. 주문 상태 확인 ---
        if (currentOrderId) {
          try {
            const orderStatus = await this.exchangeService.getOrder(
              'upbit',
              currentOrderId,
              symbol,
            );
            if (orderStatus.status === 'filled') {
              this.logger.log(
                `[AGGRESSIVE_SELL] 매도 성공! Order ID: ${orderStatus.id}, 체결 수량: ${orderStatus.filledAmount}`,
              );
              return orderStatus; // 체결 확인 후 즉시 함수 종료
            }
          } catch (orderError) {
            this.logger.warn(
              `[AGGRESSIVE_SELL] 주문 상태 확인 실패: ${orderError.message}`,
            );
            currentOrderId = null; // 다음 루프에서 재주문을 유도하기 위해 ID 리셋
          }
        }
      } catch (error) {
        // 이 catch 블록은 이제 API 통신 오류 등 예상치 못한 오류만 처리하게 됨
        this.logger.error(
          `[AGGRESSIVE_SELL] 매도 시도 중 예측하지 못한 오류 발생: ${error.message}. 5초 후 재시도합니다.`,
        );
      }
      await delay(5000); // 다음 시도까지 5초 대기
    }
  }

  /**
   * 입금이 완료될 때까지 주기적으로 잔고를 확인합니다.
   */
  private async pollDepositConfirmation(
    cycleId: string,
    exchange: ExchangeType,
    symbol: string,
    expectedAmount: number,
  ): Promise<number> {
    const startTime = Date.now();
    this.logger.log(
      `[POLLING] Start polling for deposit of ${expectedAmount} ${symbol} on ${exchange}. Timeout: ${this.DEPOSIT_TIMEOUT_MS}ms`,
    );

    // 1. 입금 확인 전 현재 잔고 조회
    const initialBalances = await this.exchangeService.getBalances(exchange);
    const initialBalance =
      initialBalances.find(
        (b) => b.currency.toUpperCase() === symbol.toUpperCase(),
      )?.available || 0;

    this.logger.log(
      `[POLLING_DEBUG] Initial Balance for ${symbol}: ${initialBalance}`,
    );
    this.logger.log(
      `[POLLING_DEBUG] Expected Amount to Arrive: ${expectedAmount}`,
    );

    // 2. 잔고가 증가할 때까지 대기
    while (Date.now() - startTime < this.DEPOSIT_TIMEOUT_MS) {
      try {
        const currentBalances =
          await this.exchangeService.getBalances(exchange);
        const currentBalance =
          currentBalances.find(
            (b) => b.currency.toUpperCase() === symbol.toUpperCase(),
          )?.available || 0;

        const actualDepositedAmount = currentBalance - initialBalance;
        const depositPercentage =
          (actualDepositedAmount / expectedAmount) * 100;

        this.logger.log(
          `[POLLING_DEBUG] Checking... | Current Balance: ${currentBalance} | Actual Deposited: ${actualDepositedAmount.toFixed(8)} | Expected: ${expectedAmount} | Percentage: ${depositPercentage.toFixed(2)}%`,
        );
        // 50% 이상이 입금되면 성공으로 간주하고 실제 총 잔액 반환
        if (depositPercentage >= 50) {
          this.logger.log(
            `[POLLING] ✅ Deposit confirmed! ${depositPercentage.toFixed(2)}% (${actualDepositedAmount.toFixed(8)} ${symbol}) of expected amount received. Proceeding with actual balance: ${currentBalance} ${symbol}`,
          );

          // 텔레그램 알림
          await this.telegramService.sendMessage(
            `📥 [입금 확인] ${symbol} ${depositPercentage.toFixed(2)}% (${actualDepositedAmount.toFixed(8)}/${expectedAmount}) 입금 완료. 실제 잔액 ${currentBalance} ${symbol}로 매도 진행.`,
          );

          return currentBalance; // 실제 총 잔액 반환 (50% 이상이면 성공)
        }
        await delay(this.POLLING_INTERVAL_MS * 5); // 입금 확인은 더 긴 간격으로 폴링
      } catch (e) {
        this.logger.warn(
          `[POLLING] Error while polling deposit for ${symbol}: ${e.message}. Retrying...`,
        );
        await delay(this.POLLING_INTERVAL_MS * 5);
      }
    }
    // 타임아웃 시에도 현재 잔액을 반환 (최소한의 수량이라도 매도)
    const finalBalances = await this.exchangeService.getBalances(exchange);
    const finalBalance =
      finalBalances.find(
        (b) => b.currency.toUpperCase() === symbol.toUpperCase(),
      )?.available || 0;
    const actualDepositedAmount = finalBalance - initialBalance;
    const depositPercentage = (actualDepositedAmount / expectedAmount) * 100;

    this.logger.warn(
      `[POLLING] ⚠️ Deposit polling timed out. Final balance: ${finalBalance} ${symbol} (${depositPercentage.toFixed(2)}% of expected). Proceeding with available balance.`,
    );

    await this.telegramService.sendMessage(
      `⚠️ [입금 타임아웃] ${symbol} 입금 확인 타임아웃. 현재 잔액 ${finalBalance} ${symbol} (${depositPercentage.toFixed(2)}%)로 매도 진행.`,
    );

    return finalBalance; // 타임아웃 시에도 현재 잔액 반환
  }
}
