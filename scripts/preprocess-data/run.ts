import * as fs from 'fs';
import * as Papa from 'papaparse';
import { format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

interface CryptoDataRow {
  candle_date_time_utc: string;
  trade_price: string;
  [key: string]: any;
}

interface FxDataRow {
  date: string;
  close: string;
  [key: string]: any;
}

interface MergedData {
  timestamp_utc: string;
  upbit_price: number;
  binance_price: number;
  usd_krw_rate: number;
}

// 타임스탬프 로드 및 변환 함수
function loadAndGetTimestamps(
  filePath: string,
  dateColumnName: string,
): Date[] {
  console.log(`${filePath} 파일의 타임스탬프 로드 중...`);

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data } = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    const timestamps: Date[] = [];
    let processedCount = 0;
    let errorCount = 0;

    for (const row of data as any[]) {
      try {
        let dateStr = row[dateColumnName];

        // KST 표시 제거 및 UTC 변환
        if (dateColumnName === 'candle_date_time_utc') {
          // 업비트/바이낸스 데이터의 경우
          dateStr = dateStr.replace(' (KST)', '').trim();
          if (dateStr.endsWith('Z')) {
            // 이미 UTC인 경우
            timestamps.push(new Date(dateStr));
          } else {
            // KST로 가정하고 UTC로 변환
            timestamps.push(fromZonedTime(new Date(dateStr), 'Asia/Seoul'));
          }
        } else {
          // 환율 데이터의 경우 (date 컬럼)
          timestamps.push(fromZonedTime(new Date(dateStr), 'Asia/Seoul'));
        }

        processedCount++;
      } catch (error) {
        errorCount++;
        console.warn(`타임스탬프 처리 오류: ${error}`);
      }
    }

    console.log(`  - 처리된 타임스탬프: ${processedCount}개`);
    console.log(`  - 오류 타임스탬프: ${errorCount}개`);

    return timestamps;
  } catch (error) {
    console.error(`파일 로드 오류 (${filePath}):`, error);
    return [];
  }
}

// 업비트/바이낸스 데이터 처리 함수
function processCryptoData(
  filePath: string,
  priceColumnName: string,
  startTime: Date,
  endTime: Date,
): Map<string, number> {
  console.log(`${filePath} 파일 처리 중...`);

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data } = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    const priceMap = new Map<string, number>();
    let processedCount = 0;
    let filteredCount = 0;
    let errorCount = 0;

    for (const row of data as CryptoDataRow[]) {
      try {
        let timestampStr = row.candle_date_time_utc;
        timestampStr = timestampStr.replace(' (KST)', '').trim();

        let currentTimestamp: Date;
        if (timestampStr.endsWith('Z')) {
          currentTimestamp = new Date(timestampStr);
        } else {
          currentTimestamp = fromZonedTime(
            new Date(timestampStr),
            'Asia/Seoul',
          );
        }

        // 공통 시간대 필터링
        if (currentTimestamp >= startTime && currentTimestamp <= endTime) {
          const timestamp = format(
            currentTimestamp,
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
          );
          const price = parseFloat(row[priceColumnName]);

          if (!isNaN(price) && price > 0) {
            priceMap.set(timestamp, price);
            processedCount++;
          } else {
            errorCount++;
          }
        } else {
          filteredCount++;
        }
      } catch (error) {
        errorCount++;
        console.warn(`데이터 처리 오류: ${error}`);
      }
    }

    console.log(`  - 처리된 레코드: ${processedCount}개`);
    console.log(`  - 필터링된 레코드: ${filteredCount}개`);
    console.log(`  - 오류 레코드: ${errorCount}개`);

    return priceMap;
  } catch (error) {
    console.error(`파일 로드 오류 (${filePath}):`, error);
    return new Map<string, number>();
  }
}

// 환율 데이터 처리 및 변환 함수
function processFxData(
  filePath: string,
  startTime: Date,
  endTime: Date,
): Map<string, number> {
  console.log(`${filePath} 파일 처리 중...`);

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data } = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rateMap = new Map<string, number>();
    let processedCount = 0;
    let filteredCount = 0;
    let errorCount = 0;

    for (const row of data as FxDataRow[]) {
      try {
        const currentTimestamp = fromZonedTime(
          new Date(row.date),
          'Asia/Seoul',
        );

        // 공통 시간대 필터링
        if (currentTimestamp >= startTime && currentTimestamp <= endTime) {
          const timestamp = format(
            currentTimestamp,
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
          );
          const closeValue = parseFloat(row.close);

          if (!isNaN(closeValue) && closeValue > 0) {
            const krwPerUsd = 1 / closeValue; // USD/KRW로 변환
            rateMap.set(timestamp, krwPerUsd);
            processedCount++;
          } else {
            errorCount++;
          }
        } else {
          filteredCount++;
        }
      } catch (error) {
        errorCount++;
        console.warn(`환율 데이터 처리 오류: ${error}`);
      }
    }

    console.log(`  - 처리된 레코드: ${processedCount}개`);
    console.log(`  - 필터링된 레코드: ${filteredCount}개`);
    console.log(`  - 오류 레코드: ${errorCount}개`);

    return rateMap;
  } catch (error) {
    console.error(`환율 파일 로드 오류 (${filePath}):`, error);
    return new Map<string, number>();
  }
}

// 메인 로직
async function main() {
  console.log('=== 백테스팅용 통합 데이터 파일 생성 시작 ===');
  console.log('공통 시간대 데이터 추출 및 통합 작업 시작...');

  // 파일 경로 설정
  const upbitFilePath = './scripts/preprocess-data/ADA/UPBIT_ADAKRW_1m.csv';
  const binanceFilePath =
    './scripts/preprocess-data/ADA/BINANCE_ADAUSDT_1m.csv';
  const fxFilePath =
    './scripts/preprocess-data/EXCHANGE-RATE/KRW_USD_6M_1M_bars_clean.csv';

  // 파일 존재 여부 확인
  if (!fs.existsSync(upbitFilePath)) {
    console.error(
      `오류: 업비트 데이터 파일을 찾을 수 없습니다: ${upbitFilePath}`,
    );
    process.exit(1);
  }
  if (!fs.existsSync(binanceFilePath)) {
    console.error(
      `오류: 바이낸스 데이터 파일을 찾을 수 없습니다: ${binanceFilePath}`,
    );
    process.exit(1);
  }
  if (!fs.existsSync(fxFilePath)) {
    console.error(`오류: 환율 데이터 파일을 찾을 수 없습니다: ${fxFilePath}`);
    process.exit(1);
  }

  // 1. 각 데이터 소스별로 타임스탬프 로드
  console.log('\n=== 1단계: 타임스탬프 로드 ===');
  const upbitTimestamps = loadAndGetTimestamps(
    upbitFilePath,
    'candle_date_time_utc',
  );
  const binanceTimestamps = loadAndGetTimestamps(
    binanceFilePath,
    'candle_date_time_utc',
  );
  const fxTimestamps = loadAndGetTimestamps(fxFilePath, 'date');

  // 2. 각 데이터의 시작/종료 시간 계산
  console.log('\n=== 2단계: 공통 시간대 계산 ===');

  // 배열을 순회하여 최소/최대값 찾기 (스택 오버플로우 방지)
  let upbitMin = upbitTimestamps[0].getTime();
  let upbitMax = upbitTimestamps[0].getTime();
  for (const timestamp of upbitTimestamps) {
    const time = timestamp.getTime();
    if (time < upbitMin) upbitMin = time;
    if (time > upbitMax) upbitMax = time;
  }
  const upbitStartTime = new Date(upbitMin);
  const upbitEndTime = new Date(upbitMax);

  let binanceMin = binanceTimestamps[0].getTime();
  let binanceMax = binanceTimestamps[0].getTime();
  for (const timestamp of binanceTimestamps) {
    const time = timestamp.getTime();
    if (time < binanceMin) binanceMin = time;
    if (time > binanceMax) binanceMax = time;
  }
  const binanceStartTime = new Date(binanceMin);
  const binanceEndTime = new Date(binanceMax);

  let fxMin = fxTimestamps[0].getTime();
  let fxMax = fxTimestamps[0].getTime();
  for (const timestamp of fxTimestamps) {
    const time = timestamp.getTime();
    if (time < fxMin) fxMin = time;
    if (time > fxMax) fxMax = time;
  }
  const fxStartTime = new Date(fxMin);
  const fxEndTime = new Date(fxMax);

  console.log('각 데이터 소스의 시간 범위:');
  console.log(
    `  - 업비트: ${upbitStartTime.toISOString()} ~ ${upbitEndTime.toISOString()}`,
  );
  console.log(
    `  - 바이낸스: ${binanceStartTime.toISOString()} ~ ${binanceEndTime.toISOString()}`,
  );
  console.log(
    `  - 환율: ${fxStartTime.toISOString()} ~ ${fxEndTime.toISOString()}`,
  );

  // 3. 공통 시간대 계산 (교집합)
  const commonStartTime = new Date(
    Math.max(
      upbitStartTime.getTime(),
      binanceStartTime.getTime(),
      fxStartTime.getTime(),
    ),
  );
  const commonEndTime = new Date(
    Math.min(
      upbitEndTime.getTime(),
      binanceEndTime.getTime(),
      fxEndTime.getTime(),
    ),
  );

  console.log('\n공통 시간대 (교집합):');
  console.log(`  - 시작 시간: ${commonStartTime.toISOString()}`);
  console.log(`  - 종료 시간: ${commonEndTime.toISOString()}`);
  console.log(
    `  - 총 기간: ${Math.round(
      (commonEndTime.getTime() - commonStartTime.getTime()) /
        (1000 * 60 * 60 * 24),
    )}일`,
  );

  // 4. 공통 시간대 데이터 필터링 및 로드
  console.log('\n=== 3단계: 공통 시간대 데이터 필터링 및 로드 ===');
  const upbitPriceMap = processCryptoData(
    upbitFilePath,
    'trade_price',
    commonStartTime,
    commonEndTime,
  );
  const binancePriceMap = processCryptoData(
    binanceFilePath,
    'trade_price',
    commonStartTime,
    commonEndTime,
  );
  const usdKrwRateMap = processFxData(
    fxFilePath,
    commonStartTime,
    commonEndTime,
  );

  console.log(`\n공통 시간대 데이터 로드 완료:`);
  console.log(`  - 업비트 가격 데이터: ${upbitPriceMap.size}개`);
  console.log(`  - 바이낸스 가격 데이터: ${binancePriceMap.size}개`);
  console.log(`  - USD/KRW 환율 데이터: ${usdKrwRateMap.size}개`);

  // 5. 데이터 병합
  console.log('\n=== 4단계: 데이터 병합 ===');
  const mergedData: MergedData[] = [];
  console.log('공통 시간대 데이터 병합 중...');

  // 업비트 데이터의 타임스탬프를 기준으로 순회
  for (const [timestampStr, upbitPrice] of upbitPriceMap.entries()) {
    // 모든 소스에 해당 타임스탬프 데이터가 존재하는 경우에만 병합
    if (binancePriceMap.has(timestampStr) && usdKrwRateMap.has(timestampStr)) {
      mergedData.push({
        timestamp_utc: timestampStr,
        upbit_price: upbitPrice,
        binance_price: binancePriceMap.get(timestampStr)!,
        usd_krw_rate: usdKrwRateMap.get(timestampStr)!,
      });
    }
  }

  console.log(`병합 완료. 총 ${mergedData.length}개의 1분봉 데이터 생성.`);

  // 6. 시간순 정렬
  console.log('\n=== 5단계: 시간순 정렬 ===');
  mergedData.sort((a, b) => a.timestamp_utc.localeCompare(b.timestamp_utc));

  // 7. 최종 CSV 파일 생성
  console.log('\n=== 6단계: 최종 CSV 파일 생성 ===');
  const finalCsv = Papa.unparse(mergedData);

  // 심볼 이름 추출 (파일 경로에서)
  const symbol = 'ADA'; // 현재는 ADA로 하드코딩, 나중에 동적으로 변경 가능
  const outputPath = `./result/${symbol.toLowerCase()}-1m.csv`;

  // result 디렉토리가 없으면 생성
  if (!fs.existsSync('./result')) {
    fs.mkdirSync('./result', { recursive: true });
  }

  fs.writeFileSync(outputPath, finalCsv);

  console.log(`\n✅ 최종 백테스팅 데이터 파일 "${outputPath}" 생성 완료!`);
  console.log(`📊 통계:`);
  console.log(
    `  - 공통 시간대: ${commonStartTime.toISOString()} ~ ${commonEndTime.toISOString()}`,
  );
  console.log(`  - 총 병합된 데이터: ${mergedData.length}개`);
  console.log(
    `  - 파일 크기: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(
      2,
    )} MB`,
  );

  // 8. 샘플 데이터 출력
  if (mergedData.length > 0) {
    console.log('\n📋 샘플 데이터 (처음 5개):');
    mergedData.slice(0, 5).forEach((row, index) => {
      console.log(
        `${index + 1}. ${row.timestamp_utc}: 업비트=${row.upbit_price}, 바이낸스=${row.binance_price}, 환율=${row.usd_krw_rate}`,
      );
    });

    console.log('\n📋 샘플 데이터 (마지막 5개):');
    mergedData.slice(-5).forEach((row, index) => {
      console.log(
        `${mergedData.length - 4 + index}. ${row.timestamp_utc}: 업비트=${row.upbit_price}, 바이낸스=${row.binance_price}, 환율=${row.usd_krw_rate}`,
      );
    });
  }

  // 9. 데이터 품질 검증
  console.log('\n🔍 데이터 품질 검증:');
  const upbitPrices = mergedData.map((d) => d.upbit_price);
  const binancePrices = mergedData.map((d) => d.binance_price);
  const usdKrwRates = mergedData.map((d) => d.usd_krw_rate);

  console.log(
    `  - 업비트 가격 범위: ${Math.min(...upbitPrices)} ~ ${Math.max(
      ...upbitPrices,
    )}`,
  );
  console.log(
    `  - 바이낸스 가격 범위: ${Math.min(...binancePrices)} ~ ${Math.max(
      ...binancePrices,
    )}`,
  );
  console.log(
    `  - USD/KRW 환율 범위: ${Math.min(...usdKrwRates)} ~ ${Math.max(
      ...usdKrwRates,
    )}`,
  );

  console.log('\n🎉 공통 시간대 데이터 추출 및 통합 작업이 완료되었습니다!');
}

// 스크립트 실행
main().catch((error) => {
  console.error('스크립트 실행 오류:', error);
  process.exit(1);
});
