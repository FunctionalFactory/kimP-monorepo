import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'csv-parse';

export interface CsvRow {
  candle_date_time_utc: string;
  trade_price: string;
  candle_acc_trade_volume?: string;
  high_price?: string;
  low_price?: string;
  opening_price?: string;
}

export interface ParsedPriceData {
  symbol: string;
  timestamp: Date;
  price: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

@Injectable()
export class CsvParsingService {
  private readonly logger = new Logger(CsvParsingService.name);

  async parseCsvData(
    csvContent: string,
    symbol: string,
  ): Promise<ParsedPriceData[]> {
    return new Promise((resolve, reject) => {
      const results: ParsedPriceData[] = [];

      parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
        .on('data', (row: CsvRow) => {
          try {
            const timestamp = new Date(row.candle_date_time_utc);
            const price = parseFloat(row.trade_price);

            if (isNaN(price) || isNaN(timestamp.getTime())) {
              this.logger.warn(
                `잘못된 데이터 행 건너뛰기: ${JSON.stringify(row)}`,
              );
              return;
            }

            const parsedData: ParsedPriceData = {
              symbol,
              timestamp,
              price,
              volume: row.candle_acc_trade_volume
                ? parseFloat(row.candle_acc_trade_volume)
                : undefined,
              high: row.high_price ? parseFloat(row.high_price) : undefined,
              low: row.low_price ? parseFloat(row.low_price) : undefined,
              open: row.opening_price
                ? parseFloat(row.opening_price)
                : undefined,
              close: row.trade_price ? parseFloat(row.trade_price) : undefined,
            };

            results.push(parsedData);
          } catch (error) {
            this.logger.warn(`행 파싱 오류: ${error.message}`);
          }
        })
        .on('end', () => {
          this.logger.log(
            `${symbol}: ${results.length}개의 가격 데이터 파싱 완료`,
          );
          resolve(results);
        })
        .on('error', (error) => {
          this.logger.error(`CSV 파싱 오류: ${error.message}`);
          reject(error);
        });
    });
  }
}
