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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CsvParsingService } from './csv-parsing.service';
import {
  HistoricalPriceService,
  ArbitrageRecordService,
  PortfolioLogService,
} from '@app/kimp-core';

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

      const symbol = body.symbol;
      if (!symbol) {
        throw new HttpException('심볼이 필요합니다.', HttpStatus.BAD_REQUEST);
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
      await this.historicalPriceService.deleteHistoricalPrices(symbol);
      await this.historicalPriceService.saveHistoricalPrices(parsedData);

      return {
        success: true,
        message: `${symbol}: ${parsedData.length}개의 가격 데이터 업로드 완료`,
        data: {
          symbol: symbol,
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
      // 심볼별로 업로드된 데이터셋 정보 조회
      const datasets = await this.historicalPriceService.getDatasetInfo();

      return datasets.map((dataset) => ({
        id: dataset.symbol,
        name: `${dataset.symbol} Historical Data`,
        uploadDate: dataset.uploadDate,
        size: `${dataset.count} records`,
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
