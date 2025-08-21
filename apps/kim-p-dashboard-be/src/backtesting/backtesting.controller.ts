import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CsvParsingService } from './csv-parsing.service';
import {
  HistoricalPriceService,
  ArbitrageRecordService,
  PortfolioLogService,
  CandlestickService,
  BacktestSessionService,
  BacktestDatasetService,
} from '@app/kimp-core';
import { BacktestResultService } from './backtest-result.service';

interface BacktestResult {
  totalProfitLoss: number;
  roi: number;
  totalTrades: number;
  winRate: number;
  trades: Array<{
    id: number;
    timestamp: Date;
    profit: number;
    symbol: string;
    tradeType: string;
  }>;
}

@Controller('api/backtest')
export class BacktestingController {
  private readonly logger = new Logger(BacktestingController.name);

  constructor(
    private readonly csvParsingService: CsvParsingService,
    private readonly historicalPriceService: HistoricalPriceService,
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly portfolioLogService: PortfolioLogService,
    private readonly candlestickService: CandlestickService,
    private readonly backtestSessionService: BacktestSessionService,
    private readonly backtestDatasetService: BacktestDatasetService,
    private readonly backtestResultService: BacktestResultService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post('upload-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsvData(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    try {
      if (!file) {
        throw new HttpException('파일이 필요합니다.', HttpStatus.BAD_REQUEST);
      }

      const { exchange, symbol, timeframe } = body;
      if (!exchange || !symbol || !timeframe) {
        throw new HttpException(
          'exchange, symbol, timeframe이 필요합니다.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const csvContent = file.buffer.toString();
      const parsedData = await this.csvParsingService.parseCsvData(
        csvContent,
        symbol,
      );

      if (parsedData.length === 0) {
        throw new HttpException(
          '유효한 데이터가 없습니다.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 기존 데이터 삭제 후 새 데이터 저장
      await this.candlestickService.deleteByExchangeAndSymbol(
        exchange,
        symbol,
        timeframe,
      );

      // Candlestick 형식으로 변환하여 저장
      const candlestickData = parsedData.map((data) => ({
        exchange,
        symbol,
        timeframe,
        timestamp: data.timestamp,
        open: data.open || data.price,
        high: data.high || data.price,
        low: data.low || data.price,
        close: data.close || data.price,
        volume: data.volume || 0,
      }));

      await this.candlestickService.createMany(candlestickData);

      return {
        success: true,
        message: `${exchange} ${symbol} ${timeframe}: ${parsedData.length}개의 캔들스틱 데이터 업로드 완료`,
        data: {
          exchange,
          symbol,
          timeframe,
          count: parsedData.length,
          dateRange: {
            start: parsedData[0].timestamp,
            end: parsedData[parsedData.length - 1].timestamp,
          },
        },
      };
    } catch (error) {
      this.logger.error(`CSV 업로드 오류: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '파일 업로드 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('datasets')
  async getDatasets() {
    try {
      // 캔들스틱 데이터셋 정보 조회
      const datasets = await this.candlestickService.getAvailableDatasets();

      return datasets.map((dataset) => ({
        id: `${dataset.exchange}-${dataset.symbol}-${dataset.timeframe}`,
        name: `${dataset.exchange} ${dataset.symbol} ${dataset.timeframe}`,
        exchange: dataset.exchange,
        symbol: dataset.symbol,
        timeframe: dataset.timeframe,
        status: 'Ready',
      }));
    } catch (error) {
      this.logger.error(`데이터셋 조회 오류: ${error.message}`);
      throw new HttpException(
        '데이터셋을 가져오는 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sessions')
  async createBacktestSession(@Body() body: any) {
    try {
      const {
        datasetId,
        totalCapital,
        investmentAmount,
        minSpread = 0.5,
        maxLoss = 10,
      } = body;

      if (!datasetId || !totalCapital || !investmentAmount) {
        throw new HttpException(
          'datasetId, totalCapital, investmentAmount는 필수 파라미터입니다.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 데이터셋 존재 여부 확인
      const dataset = await this.backtestDatasetService.findById(datasetId);
      if (!dataset) {
        throw new HttpException(
          '지정된 데이터셋을 찾을 수 없습니다.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const parameters = {
        totalCapital,
        investmentAmount,
        minSpread,
        maxLoss,
      };

      const session = await this.backtestSessionService.create({
        datasetId,
        parameters,
      });

      // Feeder의 백테스트 플레이어 실행을 위한 이벤트 발생
      this.eventEmitter.emit('backtest.session.created', {
        sessionId: session.id,
        datasetId: session.datasetId,
      });

      return {
        success: true,
        message: '백테스트 세션이 생성되었습니다.',
        data: {
          sessionId: session.id,
          status: session.status,
          parameters: session.parameters,
          dataset: {
            id: dataset.id,
            name: dataset.name,
          },
        },
      };
    } catch (error) {
      this.logger.error(`백테스트 세션 생성 오류: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '백테스트 세션 생성 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions/:id')
  async getBacktestSession(@Param('id') id: string) {
    try {
      const session = await this.backtestSessionService.findById(id);

      if (!session) {
        throw new HttpException(
          '세션을 찾을 수 없습니다.',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      this.logger.error(`백테스트 세션 조회 오류: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '백테스트 세션 조회 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions/:id/results')
  async getBacktestSessionResults(@Param('id') id: string) {
    try {
      const result = await this.backtestResultService.analyze(id);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`백테스트 세션 결과 조회 오류: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '백테스트 세션 결과 조회 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('results')
  async getBacktestResults(): Promise<BacktestResult> {
    try {
      // 최신 포트폴리오 로그 조회
      const latestPortfolio =
        await this.portfolioLogService.getLatestPortfolio();

      // 모든 거래 조회 (실제로는 Trade 엔티티에서 직접 조회해야 함)
      // 임시로 빈 배열 사용
      const trades: any[] = [];

      // 결과 계산
      const totalProfitLoss = latestPortfolio
        ? Number(latestPortfolio.cycle_pnl_krw) || 0
        : 0;
      const totalInvestment = latestPortfolio
        ? Number(latestPortfolio.total_balance_krw) || 0
        : 0;
      const roi =
        totalInvestment > 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;

      const profitableTrades = trades.filter((trade) => trade.netProfitKrw > 0);
      const winRate =
        trades.length > 0 ? (profitableTrades.length / trades.length) * 100 : 0;

      const tradeResults = trades.map((trade) => ({
        id: trade.id,
        timestamp: trade.createdAt,
        profit: trade.netProfitKrw,
        symbol: trade.symbol,
        tradeType: trade.tradeType,
      }));

      return {
        totalProfitLoss,
        roi,
        totalTrades: trades.length,
        winRate,
        trades: tradeResults,
      };
    } catch (error) {
      this.logger.error(`백테스트 결과 조회 오류: ${error.message}`);
      // 에러가 발생해도 기본값으로 응답
      return {
        totalProfitLoss: 0,
        roi: 0,
        totalTrades: 0,
        winRate: 0,
        trades: [],
      };
    }
  }
}
