import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BacktestDatasetService } from '@app/kimp-core';
import { CsvParsingService } from './csv-parsing.service';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface UploadDatasetDto {
  name: string;
  description?: string;
}

@Controller('datasets')
export class DatasetsController {
  constructor(
    private readonly backtestDatasetService: BacktestDatasetService,
    private readonly csvParsingService: CsvParsingService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDataset(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDatasetDto,
  ) {
    if (!file) {
      throw new BadRequestException('파일이 업로드되지 않았습니다.');
    }

    if (!body.name) {
      throw new BadRequestException('데이터셋 이름은 필수입니다.');
    }

    // CSV 파일 검증
    const isValidCsv = await this.csvParsingService.validateCsvFile(file.path);
    if (!isValidCsv) {
      // 임시 파일 삭제
      fs.unlinkSync(file.path);
      throw new BadRequestException(
        '유효하지 않은 CSV 파일입니다. 필수 컬럼: timestamp, open, high, low, close, volume',
      );
    }

    try {
      // 고유한 파일명 생성
      const fileExtension = path.extname(file.originalname);
      const storedFileName = `${uuidv4()}${fileExtension}`;
      const newFilePath = path.join('./storage/datasets', storedFileName);

      // 파일을 새 위치로 이동
      fs.renameSync(file.path, newFilePath);

      // 파일 통계 정보 가져오기
      const fileStats = await this.csvParsingService.getFileStats(newFilePath);

      // DB에 데이터셋 정보 저장
      const dataset = await this.backtestDatasetService.create({
        name: body.name,
        description: body.description,
        originalFileName: file.originalname,
        storedFileName,
        filePath: newFilePath,
        fileSize: fileStats.size,
      });

      return {
        success: true,
        dataset: {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          originalFileName: dataset.originalFileName,
          fileSize: dataset.fileSize,
          createdAt: dataset.createdAt,
        },
      };
    } catch (error) {
      // 에러 발생 시 임시 파일 삭제
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new InternalServerErrorException(
        '파일 업로드 중 오류가 발생했습니다.',
      );
    }
  }

  @Get()
  async getAllDatasets() {
    try {
      const datasets = await this.backtestDatasetService.findAll();
      return {
        success: true,
        datasets: datasets.map((dataset) => ({
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          originalFileName: dataset.originalFileName,
          fileSize: dataset.fileSize,
          createdAt: dataset.createdAt,
        })),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        '데이터셋 목록 조회 중 오류가 발생했습니다.',
      );
    }
  }
}
