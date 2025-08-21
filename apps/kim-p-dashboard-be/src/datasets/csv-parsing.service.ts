import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CsvParsingService {
  async validateCsvFile(filePath: string): Promise<boolean> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      if (lines.length < 2) {
        return false; // 최소 헤더 + 1개 데이터 행
      }

      const header = lines[0].split(',');
      const requiredColumns = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
      
      // 필수 컬럼들이 있는지 확인
      for (const column of requiredColumns) {
        if (!header.some(h => h.toLowerCase().includes(column))) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async getFileStats(filePath: string): Promise<{ size: number; lines: number }> {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    return {
      size: stats.size,
      lines: lines.length - 1, // 헤더 제외
    };
  }
}
