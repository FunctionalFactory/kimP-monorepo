export const testConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
    password: '',
    db: 1,
  },
  watchedSymbols: [
    { symbol: 'xrp', upbit: 'KRW-XRP', binance: 'xrpusdt' },
    { symbol: 'trx', upbit: 'KRW-TRX', binance: 'trxusdt' },
  ],
  exchanges: {
    upbit: {
      apiKey: 'test_key',
      secretKey: 'test_secret',
    },
    binance: {
      apiKey: 'test_key',
      secretKey: 'test_secret',
    },
  },
};
