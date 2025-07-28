import { Injectable, Logger } from '@nestjs/common';
import {
  IExchange,
  Order,
  Balance,
  OrderBook,
  OrderType,
  OrderSide,
  WalletStatus,
  OrderStatus,
  WithdrawalChance,
  OrderBookLevel,
  TickerInfo,
  DepositHistory,
} from '../common/exchange.interface';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as querystring from 'querystring';
import { createHash } from 'crypto';

@Injectable()
export class UpbitService implements IExchange {
  private readonly logger = new Logger(UpbitService.name);
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly serverUrl = 'https://api.upbit.com';

  constructor(private readonly configService: ConfigService) {
    this.logger.error('<<<<< UpbitService (REAL) IS LOADED >>>>>');

    this.accessKey = this.configService.get<string>('UPBIT_ACCESS_KEY');
    this.secretKey = this.configService.get<string>('UPBIT_SECRET_KEY');
    if (!this.accessKey || !this.secretKey) {
      this.logger.error('Upbit API Key is missing.');
    } else {
      this.logger.log('UpbitService (REAL) has been initialized.');
    }
  }

  /**
   * 업비트의 호가 단위 규칙에 맞게 가격을 조정하는 헬퍼 함수
   * @param price 조정할 가격
   * @returns 조정되고 포맷팅된 가격 문자열
   */
  private _adjustPriceToUnit(price: number): string {
    // 반환 타입을 string으로 유지
    if (price >= 2000000) return (Math.round(price / 1000) * 1000).toFixed(0);
    if (price >= 1000000) return (Math.round(price / 500) * 500).toFixed(0);
    if (price >= 100000) return (Math.round(price / 50) * 50).toFixed(0);
    if (price >= 10000) return (Math.round(price / 10) * 10).toFixed(0);

    // 1,000원 이상은 1원 단위로 반올림
    if (price >= 1000) return Math.round(price).toFixed(0);

    // 100원 이상 1,000원 미만도 1원 단위로 반올림 (이 부분이 핵심 수정 사항)
    if (price >= 100) return Math.round(price).toFixed(0);

    // 10원 이상 100원 미만은 소수점 둘째 자리까지
    if (price >= 10) return (Math.round(price / 0.01) * 0.01).toFixed(2);

    // 1원 이상 10원 미만은 소수점 셋째 자리까지
    if (price >= 1) return (Math.round(price / 0.001) * 0.001).toFixed(3);

    // 1원 미만은 소수점 넷째 자리까지
    return (Math.round(price / 0.0001) * 0.0001).toFixed(4);
  }

  /**
   * ⭐️ [수정] 코인 심볼에 맞는 실제 네트워크 타입을 반환하는 헬퍼 함수
   * @param symbol 코인 심볼 (e.g., 'BTT', 'XRP')
   * @returns 실제 네트워크 타입 (e.g., 'TRX', 'XRP')
   */
  private getNetworkType(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();
    const networkMap: { [key: string]: string } = {
      BTT: 'TRX',
      XRP: 'XRP',
      BTC: 'Bitcoin',
      MANA: 'ETH',
      GRT: 'ETH',
      NEWT: 'ETH',
      W: 'SOL',
      APT: 'APT',
      ONDO: 'ETH',
      SHIB: 'ETH',
      SUI: 'SUI',
      UNI: 'ETH',
      SEI: 'SEI',
      PEPE: 'ETH',
      LAYER: 'SOL',
      TRUMP: 'SOL',
      SAHARA: 'ETH',
      MOVE: 'ETH',
      // 'USDT': 'TRX',
    };
    return networkMap[upperSymbol] || upperSymbol;
  }

  /**
   * ⭐️ [신규 추가] 특정 코인이 지원하는 모든 네트워크 타입 목록을 조회합니다.
   * @param symbol 조회할 코인 심볼
   * @returns 지원하는 net_type 문자열 배열
   */
  async getSupportedNetworks(): Promise<string[]> {
    // '출금 가능 정보' API는 지원 네트워크 정보를 포함하고 있습니다.
    const token = this.generateToken();
    const url = `${this.serverUrl}/v1/withdraws/coin_addresses`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // API 응답에서 net_types 배열을 추출합니다.
      const netTypes = response.data?.currency?.net_types || [];
      this.logger.log(
        `[Upbit-REAL] Supported networks for: [${netTypes.join(', ')}]`,
      );
      return netTypes;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[Upbit-REAL] Failed to get supported networks for: ${errorMessage}`,
      );
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  // [최종 수정] POST 요청 시에는 해시를 생성하지 않도록 boolean 플래그 추가
  private generateToken(params: any = {}): string {
    const payload: {
      access_key: string;
      nonce: string;
      query_hash?: string;
      query_hash_alg?: string;
    } = {
      access_key: this.accessKey,
      nonce: uuidv4(),
    };
    if (Object.keys(params).length > 0) {
      const query = querystring.encode(params);
      const hash = createHash('sha512');
      const queryHash = hash.update(query, 'utf-8').digest('hex');
      payload.query_hash = queryHash;
      payload.query_hash_alg = 'SHA512';
    }
    return sign(payload, this.secretKey);
  }

  async getBalances(): Promise<Balance[]> {
    const token = this.generateToken();
    const url = `${this.serverUrl}/v1/accounts`;

    try {
      const response = await axios.get<any[]>(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const balances: Balance[] = response.data.map((item) => {
        const balance = parseFloat(item.balance);
        const locked = parseFloat(item.locked);
        return {
          currency: item.currency,
          balance,
          locked,
          available: balance - locked,
        };
      });
      this.logger.log(
        `[Upbit-REAL] Successfully fetched ${balances.length} balances.`,
      );
      return balances;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(`[Upbit-REAL] Failed to get balances: ${errorMessage}`);
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  // [구현 완료]
  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number,
  ): Promise<Order> {
    const market = `KRW-${symbol.toUpperCase()}`;

    // [수정] side 값 변환 및 모든 파라미터를 문자열로 변환
    const params: any = {
      market: market,
      side: side === 'buy' ? 'bid' : 'ask',
      ord_type: type,
    };
    if (type === 'limit') {
      const adjustedPriceString = this._adjustPriceToUnit(price);
      this.logger.log(
        `Adjusted Upbit order price: ${price} -> ${adjustedPriceString}`,
      );

      params.volume = String(amount);
      params.price = adjustedPriceString;
    } else if (type === 'market' && side === 'buy') {
      params.ord_type = 'price';
      params.price = String(price); // 시장가 매수 시 주문 총액
    } else {
      // 시장가 매도
      params.ord_type = 'market';
      params.volume = String(amount);
    }

    const token = this.generateToken(params);
    const url = `${this.serverUrl}/v1/orders`;

    try {
      const response = await axios.post(url, params, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      // 업비트 응답을 우리 표준 Order 형태로 변환
      return this.transformUpbitOrder(data);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(`[Upbit-REAL] Failed to create order: ${errorMessage}`);
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  // [구현 완료]
  async getOrder(orderId: string, symbol?: string): Promise<Order> {
    const params = { uuid: orderId };
    const token = this.generateToken(params);
    const url = `${this.serverUrl}/v1/order?${querystring.encode(params)}`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return this.transformUpbitOrder(response.data);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[Upbit-REAL] Failed to get order ${orderId}: ${errorMessage}`,
      );
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  // [Helper] 업비트 주문 응답을 표준 Order 객체로 변환하는 헬퍼 함수
  private transformUpbitOrder(data: any): Order {
    let status: OrderStatus = 'open'; // 기본값
    if (data.state === 'done') status = 'filled';
    else if (data.state === 'cancel') status = 'canceled';
    else if (data.state === 'wait') status = 'open';

    return {
      id: data.uuid,
      symbol: data.market,
      type: data.ord_type,
      side: data.side === 'bid' ? 'buy' : 'sell',
      price: parseFloat(data.price || '0'),
      amount: parseFloat(data.volume || '0'),
      filledAmount: parseFloat(data.executed_volume || '0'),
      status: status,
      timestamp: new Date(data.created_at),
      fee: { currency: 'KRW', cost: parseFloat(data.paid_fee || '0') },
    };
  }

  // [구현 완료]
  async getWalletStatus(symbol: string): Promise<WalletStatus> {
    const token = this.generateToken();
    const url = `${this.serverUrl}/v1/status/wallet`;

    try {
      const response = await axios.get<any[]>(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const targetCurrency = response.data.find(
        (c) => c.currency.toUpperCase() === symbol.toUpperCase(),
      );

      if (!targetCurrency) {
        throw new Error(`Could not find wallet status for ${symbol}`);
      }

      const state = targetCurrency.wallet_state;
      return {
        currency: targetCurrency.currency,
        canDeposit: state === 'working' || state === 'deposit_only',
        canWithdraw: state === 'working' || state === 'withdraw_only',
        network: targetCurrency.network_name,
      };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[Upbit-REAL] Failed to get wallet status for ${symbol}: ${errorMessage}`,
      );
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  // [구현 완료]

  // [수정] catch 블록의 if 조건문 수정
  async getDepositAddress(
    symbol: string,
  ): Promise<{ address: string; tag?: string; net_type?: string }> {
    const upperCaseSymbol = symbol.toUpperCase();

    try {
      return await this.fetchCoinAddress(upperCaseSymbol);
    } catch (error) {
      // "지갑정보를 찾지 못했다"는 에러 또는 우리가 직접 발생시킨 "not generated yet" 에러를 모두 감지
      if (
        error.message.includes('디지털 자산 지갑정보를 찾지 못했습니다') ||
        error.message.includes('찾을 수 없습니다') ||
        error.message.includes('not generated yet') // ⭐️ 이 조건을 추가하여 문제를 해결합니다.
      ) {
        this.logger.warn(
          `[Upbit-REAL] Deposit address for ${upperCaseSymbol} not found. Attempting to generate one...`,
        );
        await this.generateNewCoinAddress(upperCaseSymbol);

        this.logger.log(
          `[Upbit-REAL] Address generated. Refetching address for ${upperCaseSymbol}...`,
        );
        return await this.fetchCoinAddress(upperCaseSymbol);
      }
      // 그 외 다른 에러는 그대로 throw 합니다.
      throw error;
    }
  }

  // [수정] net_type 파라미터를 추가하여 generateNewCoinAddress와 파라미터 구성을 통일
  private async fetchCoinAddress(
    currency: string,
  ): Promise<{ address: string; tag?: string; net_type?: string }> {
    const params = {
      currency: currency,
      net_type: this.getNetworkType(currency), // ⭐️ 파라미터 추가
    };
    const token = this.generateToken(params);
    const url = `${this.serverUrl}/v1/deposits/coin_address?${querystring.encode(params)}`;
    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      if (!data.deposit_address) {
        throw new Error(
          `Deposit address for ${currency} is not generated yet.`,
        );
      }
      return {
        address: data.deposit_address,
        tag: data.secondary_address,
        net_type: data.net_type,
      };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.warn(
        `[Upbit-REAL] Could not fetch coin address for ${currency}: ${errorMessage}`,
      );
      throw new Error(errorMessage);
    }
  }

  // [수정] net_type 파라미터 추가
  private async generateNewCoinAddress(currency: string): Promise<any> {
    const params = {
      currency: currency,
      net_type: this.getNetworkType(currency), // ◀️ 기존: currency, 수정: this.getNetworkType(currency)
    };
    const token = this.generateToken(params);
    const url = `${this.serverUrl}/v1/deposits/generate_coin_address`;

    this.logger.log(
      `[Upbit-REAL] Generating new address for ${currency} with net_type: ${currency}`,
    );
    try {
      const response = await axios.post(url, params, {
        headers: { Authorization: `Bearer ${token}` },
      });
      this.logger.log(
        `[Upbit-REAL] Successfully sent request to generate address for ${currency}.`,
      );
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[Upbit-REAL] Failed to generate new address for ${currency}: ${errorMessage}`,
      );
      throw new Error(errorMessage);
    }
  }

  // [수정] getWithdrawalFee를 삭제하고 getWithdrawalChance를 최종 수정
  async getWithdrawalChance(symbol: string): Promise<WithdrawalChance> {
    const upperCaseSymbol = symbol.toUpperCase();
    const params = {
      currency: upperCaseSymbol,
      net_type: this.getNetworkType(upperCaseSymbol),
    };
    const token = this.generateToken(params);
    const url = `${this.serverUrl}/v1/withdraws/chance?${querystring.encode(params)}`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const currencyInfo = response.data?.currency;
      const memberLevel = response.data?.member_level;

      if (!currencyInfo || !memberLevel) {
        throw new Error('Invalid response from Upbit withdraw/chance API');
      }

      return {
        currency: symbol,
        fee: parseFloat(currencyInfo.withdraw_fee || '0'),
        minWithdrawal: parseFloat(currencyInfo.withdraw_min || '0'),
      };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[Upbit-REAL] Failed to get withdrawal chance for ${symbol}: ${errorMessage}`,
      );
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  async withdraw(
    symbol: string,
    address: string,
    amount: string,
    secondary_address?: string,
    net_type?: string,
  ): Promise<any> {
    const upperCaseSymbol = symbol.toUpperCase();

    // 1. 해싱에 사용할 파라미터 (공식 문서 예시 기준)
    const paramsForHash: any = {
      currency: String(upperCaseSymbol),
      net_type: net_type,
      amount: amount,
      address: String(address),
      secondary_address: secondary_address,
    };

    // 2. 실제 API 요청 본문에 보낼 파라미터 (추가 정보 포함)
    const paramsForBody: any = {
      ...paramsForHash,
      // ,
      // transaction_type: 'default',
    };

    const token = this.generateToken(paramsForHash);
    const url = `${this.serverUrl}/v1/withdraws/coin`;

    try {
      const response = await axios.post(url, paramsForBody, {
        headers: { Authorization: `Bearer ${token}` },
      });
      this.logger.log(
        `[Upbit-REAL] Successfully requested withdrawal for ${amount} ${symbol}.`,
      );
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[Upbit-REAL] Failed to withdraw ${symbol}: ${errorMessage}`,
      );
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  // --- 이하 미구현 메소드들 ---
  async getOrderBook(symbol: string): Promise<OrderBook> {
    const market = `KRW-${symbol.toUpperCase()}`;
    const url = `${this.serverUrl}/v1/orderbook?markets=${market}`;

    try {
      // 업비트 API는 인증이 필요 없습니다.
      const response = await axios.get(url);
      const data = response.data[0]; // 배열의 첫 번째 요소가 해당 마켓의 오더북입니다.

      if (!data) {
        throw new Error(`No order book data returned for market ${market}`);
      }

      // 업비트 응답(orderbook_units)을 표준 OrderBook 형태로 변환합니다.
      const bids: OrderBookLevel[] = data.orderbook_units.map((unit: any) => ({
        price: unit.bid_price,
        amount: unit.bid_size,
      }));

      const asks: OrderBookLevel[] = data.orderbook_units.map((unit: any) => ({
        price: unit.ask_price,
        amount: unit.ask_size,
      }));

      return {
        symbol: data.market,
        bids,
        asks,
        timestamp: new Date(data.timestamp),
      };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[Upbit-REAL] Failed to get order book for ${symbol}: ${errorMessage}`,
      );
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  async getTickerInfo(symbol: string): Promise<TickerInfo> {
    const market = `KRW-${symbol.toUpperCase()}`;
    const url = `${this.serverUrl}/v1/ticker?markets=${market}`;

    try {
      const response = await axios.get(url);
      const data = response.data[0];

      if (!data) {
        throw new Error(`No ticker data returned for market ${market}`);
      }

      return {
        symbol: data.market,
        quoteVolume: data.acc_trade_price_24h, // 업비트는 'acc_trade_price_24h'가 24시간 누적 거래대금(KRW)
      };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[Upbit-REAL] Failed to get ticker info for ${symbol}: ${errorMessage}`,
      );
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<any> {
    const params = { uuid: orderId };
    const token = this.generateToken(params);
    const url = `${this.serverUrl}/v1/order?${querystring.encode(params)}`;

    try {
      const response = await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      this.logger.log(
        `[Upbit-REAL] Order ${orderId} cancellation requested successfully.`,
      );
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[Upbit-REAL] Failed to cancel order ${orderId}: ${errorMessage}`,
      );
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  // ... 기존 코드 ...

  async getDepositHistory(
    symbol: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<DepositHistory[]> {
    const token = this.generateToken();
    const url = `${this.serverUrl}/v1/deposits`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const filteredDeposits = response.data
        .filter(
          (deposit: any) =>
            deposit.currency.toUpperCase() === symbol.toUpperCase(),
        )
        .filter((deposit: any) => {
          const depositTime = new Date(deposit.created_at);
          if (startTime && depositTime < startTime) return false;
          if (endTime && depositTime > endTime) return false;
          return true;
        });

      this.logger.log(
        `[Upbit-REAL] Successfully fetched ${filteredDeposits.length} deposit records for ${symbol}`,
      );

      return filteredDeposits.map((deposit: any) => ({
        id: deposit.uuid,
        symbol: deposit.currency,
        amount: parseFloat(deposit.amount),
        status:
          deposit.state === 'ACCEPTED'
            ? 'COMPLETED'
            : deposit.state === 'PENDING'
              ? 'PENDING'
              : 'FAILED',
        timestamp: new Date(deposit.created_at),
        txId: deposit.txid,
        address: deposit.deposit_address,
        network: deposit.network,
      }));
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      this.logger.error(
        `[Upbit-REAL] Failed to get deposit history for ${symbol}: ${errorMessage}`,
      );
      throw new Error(`Upbit API Error: ${errorMessage}`);
    }
  }

  async createFuturesOrder(
    symbol: string,
    side: OrderSide,
    type: OrderType,
    amount: number,
    price?: number,
  ): Promise<Order> {
    this.logger.error('[Upbit-REAL] Upbit does not support futures trading.');
    // 업비트는 선물 거래를 지원하지 않으므로, 호출 시 에러를 발생시킵니다.
    return null;
  }

  async getFuturesBalances(
    walletType: 'SPOT' | 'UMFUTURE',
  ): Promise<Balance[]> {
    return;
  }

  async internalTransfer(
    asset: string,
    amount: number,
    from: string,
    to: string,
  ): Promise<any> {
    return null;
  }
}
