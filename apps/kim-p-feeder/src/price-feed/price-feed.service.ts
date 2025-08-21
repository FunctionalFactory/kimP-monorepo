// apps/kim-p-feeder/src/price-feed/price-feed.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as WebSocket from 'ws';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { BehaviorSubject } from 'rxjs';
import {
  ExchangeService,
  HistoricalPriceService,
  CandlestickService,
} from '@app/kimp-core';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { FeederBacktestSessionService } from '../backtest-session/backtest-session.service';

export interface PriceUpdateData {
  symbol: string;
  exchange: 'upbit' | 'binance';
  price: number;
  timestamp: number;
  sessionId?: string;
}

export interface WatchedSymbolConfig {
  symbol: string;
  upbit: string;
  binance: string;
}

@Injectable()
export class PriceFeedService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceFeedService.name);
  private upbitSockets = new Map<string, WebSocket>();
  private binanceSockets = new Map<string, WebSocket>();

  private upbitPrices = new Map<string, number>();
  private binancePrices = new Map<string, number>();

  private readonly _watchedSymbolsConfig: ReadonlyArray<WatchedSymbolConfig>;

  private connectedSockets = new Set<string>();
  private totalRequiredConnections = 0;

  private allConnectionsEstablished = new BehaviorSubject<boolean>(false);

  private upbitVolumes = new Map<string, number>();
  private upbitOrderBooks = new Map<string, any>();

  constructor(
    private readonly configService: ConfigService,
    private readonly exchangeService: ExchangeService,
    private readonly redisPublisherService: RedisPublisherService,
    private readonly historicalPriceService: HistoricalPriceService,
    private readonly candlestickService: CandlestickService,
    private readonly backtestSessionService: FeederBacktestSessionService,
  ) {
    this._watchedSymbolsConfig = this.configService.get<WatchedSymbolConfig[]>(
      'WATCHED_SYMBOLS',
    ) || [
      { symbol: 'xrp', upbit: 'KRW-XRP', binance: 'xrpusdt' },
      { symbol: 'trx', upbit: 'KRW-TRX', binance: 'trxusdt' },
      { symbol: 'doge', upbit: 'KRW-DOGE', binance: 'dogeusdt' },
      { symbol: 'sol', upbit: 'KRW-SOL', binance: 'solusdt' },
      { symbol: 'algo', upbit: 'KRW-ALGO', binance: 'algousdt' },
      { symbol: 'ada', upbit: 'KRW-ADA', binance: 'adausdt' },
      { symbol: 'dot', upbit: 'KRW-DOT', binance: 'dotusdt' },
      { symbol: 'avax', upbit: 'KRW-AVAX', binance: 'avaxusdt' },
      { symbol: 'vet', upbit: 'KRW-VET', binance: 'vetusdt' },
      { symbol: 'icx', upbit: 'KRW-ICX', binance: 'icxusdt' },
      { symbol: 'qtum', upbit: 'KRW-QTUM', binance: 'qtumusdt' },
      { symbol: 'neo', upbit: 'KRW-NEO', binance: 'neousdt' },
      { symbol: 'mana', upbit: 'KRW-MANA', binance: 'manausdt' },
      { symbol: 'grt', upbit: 'KRW-GRT', binance: 'grtusdt' },
      { symbol: 'ardr', upbit: 'KRW-ARDR', binance: 'ardrusdt' },
      { symbol: 'newt', upbit: 'KRW-NEWT', binance: 'newtusdt' },
      { symbol: 'sahara', upbit: 'KRW-SAHARA', binance: 'saharausdt' },
      { symbol: 'move', upbit: 'KRW-MOVE', binance: 'moveusdt' },
      { symbol: 'trump', upbit: 'KRW-TRUMP', binance: 'trumpusdt' },
      { symbol: 'layer', upbit: 'KRW-LAYER', binance: 'layerusdt' },
      { symbol: 'pepe', upbit: 'KRW-PEPE', binance: 'pepeusdt' },
      { symbol: 'ondo', upbit: 'KRW-ONDO', binance: 'ondousdt' },
      { symbol: 'shib', upbit: 'KRW-SHIB', binance: 'shibusdt' },
      { symbol: 'sui', upbit: 'KRW-SUI', binance: 'suiusdt' },
      { symbol: 'uni', upbit: 'KRW-UNI', binance: 'uniusdt' },
      { symbol: 'apt', upbit: 'KRW-APT', binance: 'aptusdt' },
    ];
    this.totalRequiredConnections = this._watchedSymbolsConfig.length * 2;
  }

  async onModuleInit() {
    this.logger.log(
      'PriceFeedService Initialized. Starting to connect to WebSockets...',
    );

    const feederMode = this.configService.get<string>('FEEDER_MODE', 'live');

    if (feederMode === 'backtest') {
      this.logger.log('백테스팅 모드로 시작합니다...');
      await this.startBacktestMode();
    } else {
      this.logger.log('실시간 모드로 시작합니다...');
      this.connectToAllFeeds();
      this.initializeOrderBooks();
    }
  }

  onModuleDestroy() {
    this.logger.log(
      'PriceFeedService Destroyed. Closing all WebSocket connections...',
    );
    this.closeAllSockets();
  }

  private async initializeOrderBooks() {
    this.logger.log('초기 오더북 정보를 로드합니다...');
    for (const { symbol } of this._watchedSymbolsConfig) {
      try {
        const orderBook = await this.exchangeService.getOrderBook(
          'upbit',
          symbol,
        );
        this.upbitOrderBooks.set(symbol, orderBook);
        this.logger.verbose(`[초기 오더북] ${symbol.toUpperCase()} 로드 완료`);
      } catch (error) {
        this.logger.warn(
          `[초기 오더북] ${symbol.toUpperCase()} 로드 실패: ${error.message}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.logger.log('초기 오더북 로드가 완료되었습니다.');
  }

  @Cron('*/5 * * * *')
  async handleOrderBookUpdate() {
    for (const { symbol } of this._watchedSymbolsConfig) {
      try {
        const orderBook = await this.exchangeService.getOrderBook(
          'upbit',
          symbol,
        );
        this.upbitOrderBooks.set(symbol, orderBook);
      } catch (error) {
        this.logger.warn(
          `[오더북 캐시] ${symbol.toUpperCase()} 업데이트 실패: ${error.message}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  public getWatchedSymbols(): ReadonlyArray<WatchedSymbolConfig> {
    return this._watchedSymbolsConfig;
  }

  public getConnectionStatus(): 'connected' | 'disconnected' {
    return this.allConnectionsEstablished.getValue()
      ? 'connected'
      : 'disconnected';
  }

  private checkAndEmitConnectionStatus() {
    const isReady =
      this.connectedSockets.size === this.totalRequiredConnections;

    // allConnectionsEstablished BehaviorSubject 업데이트
    this.allConnectionsEstablished.next(isReady);

    if (isReady) {
      this.logger.log(
        '✅ All WebSocket connections established. System is ready.',
      );
    } else {
      this.logger.warn(
        `🔌 WebSocket connections: ${this.connectedSockets.size}/${this.totalRequiredConnections}. System is not ready.`,
      );
    }
  }

  @Cron('*/5 * * * *')
  async handleVolumeUpdate() {
    for (const { symbol } of this._watchedSymbolsConfig) {
      try {
        const tickerInfo = await this.exchangeService.getTickerInfo(
          'upbit',
          symbol,
        );
        this.upbitVolumes.set(symbol, tickerInfo.quoteVolume);
      } catch (error) {
        this.logger.warn(
          `[거래대금 캐시] ${symbol.toUpperCase()} 정보 업데이트 실패: ${error.message}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  public getUpbitVolume(symbol: string): number | undefined {
    return this.upbitVolumes.get(symbol);
  }

  public getUpbitOrderBook(symbol: string): any | undefined {
    return this.upbitOrderBooks.get(symbol);
  }

  private async connectToAllFeeds() {
    for (const { symbol, upbit, binance } of this._watchedSymbolsConfig) {
      this.connectToUpbit(symbol, upbit);
      this.connectToBinance(symbol, binance);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  public getUpbitPrice(symbol: string): number | undefined {
    return this.upbitPrices.get(symbol);
  }

  public getBinancePrice(symbol: string): number | undefined {
    return this.binancePrices.get(symbol);
  }

  public getAllUpbitPrices(): ReadonlyMap<string, number> {
    return this.upbitPrices;
  }

  public getAllBinancePrices(): ReadonlyMap<string, number> {
    return this.binancePrices;
  }

  private connectToUpbit(symbol: string, market: string) {
    if (this.upbitSockets.has(symbol)) {
      this.logger.warn(
        `[Upbit] WebSocket for ${market} already exists or is connecting.`,
      );
      return;
    }
    const socket = new WebSocket('wss://api.upbit.com/websocket/v1');
    this.upbitSockets.set(symbol, socket);

    socket.on('open', () => {
      this.logger.log(`🟢 [Upbit] Connected for ${market}`);
      this.connectedSockets.add(`upbit-${symbol}`);
      this.checkAndEmitConnectionStatus();
      const payload = [
        { ticket: `kimP-pricefeed-${symbol}` },
        { type: 'ticker', codes: [market] },
      ];
      socket.send(JSON.stringify(payload));
    });

    socket.on('message', (data) => {
      try {
        const messageString = data.toString('utf8');
        if (messageString === 'PONG') {
          return;
        }
        const json = JSON.parse(messageString);
        if (json.type === 'ticker' && json.code === market) {
          const price = json.trade_price;
          if (typeof price !== 'number' || isNaN(price)) {
            this.logger.warn(
              `[Upbit ${symbol}] Invalid price received: ${price}`,
            );
            return;
          }
          this.upbitPrices.set(symbol, price);

          // Redis에 가격 업데이트 발행
          const priceUpdateData: PriceUpdateData = {
            symbol,
            exchange: 'upbit',
            price,
            timestamp: Date.now(),
          };
          this.redisPublisherService.publishPriceUpdate(priceUpdateData);
        }
      } catch (e) {
        this.logger.error(
          `❌ [Upbit ${symbol}] message parse error: ${e instanceof Error ? e.message : e}`,
        );
      }
    });

    socket.on('close', (code, reason) => {
      this.logger.warn(
        `🔌 [Upbit] Disconnected for ${market}. Code: ${code}, Reason: ${reason.toString()}. Reconnecting...`,
      );
      this.connectedSockets.delete(`upbit-${symbol}`);
      this.checkAndEmitConnectionStatus();
      this.upbitSockets.delete(symbol);
      setTimeout(() => this.connectToUpbit(symbol, market), 5000);
    });

    socket.on('error', (err) => {
      this.logger.error(`🔥 [Upbit] ${market} WebSocket Error: ${err.message}`);
    });
  }

  private connectToBinance(symbol: string, streamPair: string) {
    if (this.binanceSockets.has(symbol)) {
      this.logger.warn(
        `[Binance] WebSocket for ${streamPair} already exists or is connecting.`,
      );
      return;
    }
    const socket = new WebSocket(
      `wss://stream.binance.com:9443/ws/${streamPair}@ticker`,
    );
    this.binanceSockets.set(symbol, socket);

    socket.on('open', () => {
      this.logger.log(`🟢 [Binance] Connected for ${streamPair}`);
      this.connectedSockets.add(`binance-${symbol}`);
      this.checkAndEmitConnectionStatus();
    });

    socket.on('message', (data) => {
      try {
        const raw = data.toString('utf8');
        const json = JSON.parse(raw);
        if (json.e === '24hrTicker') {
          const price = parseFloat(json?.c);
          if (isNaN(price)) {
            this.logger.warn(
              `⚠️ [Binance ${symbol}] price invalid or null:`,
              json.c,
            );
            return;
          }
          this.binancePrices.set(symbol, price);

          // Redis에 가격 업데이트 발행
          const priceUpdateData: PriceUpdateData = {
            symbol,
            exchange: 'binance',
            price,
            timestamp: Date.now(),
          };
          this.redisPublisherService.publishPriceUpdate(priceUpdateData);
        }
      } catch (e) {
        this.logger.error(
          `❌ [Binance ${symbol}] message parse error: ${e instanceof Error ? e.message : e}`,
        );
      }
    });

    socket.on('close', (code, reason) => {
      this.logger.warn(
        `🔌 [Binance] Disconnected for ${streamPair}. Code: ${code}, Reason: ${reason.toString()}. Reconnecting...`,
      );
      this.connectedSockets.delete(`binance-${symbol}`);
      this.checkAndEmitConnectionStatus();
      this.binanceSockets.delete(symbol);
      setTimeout(() => this.connectToBinance(symbol, streamPair), 5000);
    });

    socket.on('error', (err) => {
      this.logger.error(
        `🔥 [Binance] ${streamPair} WebSocket Error: ${err.message}`,
      );
    });
  }

  private closeAllSockets() {
    this.upbitSockets.forEach((socket, symbol) => {
      this.logger.log(`Closing Upbit WebSocket for ${symbol}`);
      socket.removeAllListeners();
      socket.terminate();
    });
    this.upbitSockets.clear();

    this.binanceSockets.forEach((socket, symbol) => {
      this.logger.log(`Closing Binance WebSocket for ${symbol}`);
      socket.removeAllListeners();
      socket.terminate();
    });
    this.binanceSockets.clear();
  }

  private async startBacktestMode() {
    try {
      this.logger.log('백테스팅 모드: 세션 초기화 중...');

      // 백테스트 세션 초기화
      await this.backtestSessionService.initializeSession();

      const sessionId = this.backtestSessionService.getCurrentSessionId();
      if (!sessionId) {
        this.logger.warn('백테스트 세션이 초기화되지 않았습니다.');
        return;
      }

      this.logger.log('백테스팅 모드: 캔들스틱 데이터 로딩 중...');

      // 세션에 해당하는 캔들스틱 데이터 조회
      const candlestickData =
        await this.backtestSessionService.getCandlestickData();

      if (candlestickData.length === 0) {
        this.logger.warn('백테스팅 모드: 캔들스틱 데이터가 없습니다.');
        await this.backtestSessionService.markSessionAsFailed();
        return;
      }

      this.logger.log(
        `백테스팅 모드: ${candlestickData.length}개의 캔들스틱 데이터를 처리합니다.`,
      );

      // 세션 ID를 포함하여 Redis에 데이터 발행
      for (const data of candlestickData) {
        if (data.upbit) {
          await this.redisPublisherService.publishPriceUpdate({
            symbol: data.upbit.symbol,
            exchange: 'upbit',
            price: data.upbit.close,
            timestamp: data.timestamp.getTime(),
            sessionId: sessionId,
          });
        }

        if (data.binance) {
          await this.redisPublisherService.publishPriceUpdate({
            symbol: data.binance.symbol,
            exchange: 'binance',
            price: data.binance.close,
            timestamp: data.timestamp.getTime(),
            sessionId: sessionId,
          });
        }

        // 100ms 지연으로 실시간 피드 시뮬레이션
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.logger.log('백테스팅 모드: 모든 캔들스틱 데이터 처리 완료');

      // 세션 완료 처리
      await this.backtestSessionService.markSessionAsCompleted({
        totalTrades: 0, // 실제 거래 결과는 Initiator/Finalizer에서 계산
        successfulTrades: 0,
        totalProfit: 0,
        totalLoss: 0,
        netProfit: 0,
        winRate: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        trades: [],
      });
    } catch (error) {
      this.logger.error(`백테스팅 모드 오류: ${error.message}`);
      await this.backtestSessionService.markSessionAsFailed();
    }
  }
}
