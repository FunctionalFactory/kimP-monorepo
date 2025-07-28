export type MarketDirection = 'NORMAL' | 'REVERSE';
export type StrategyType = 'HIGH_PREMIUM_FIRST' | 'LOW_PREMIUM_FIRST';

export interface ISession {
  id: string;
  status: SessionStatus;
  cycleId: string | null;
  highPremiumData: HighPremiumSessionData | null;
  lowPremiumData: LowPremiumSessionData | null;
  marketDirection: MarketDirection;
  strategyType: StrategyType;
  createdAt: Date;
  updatedAt: Date;
  priority: number;
}

export interface HighPremiumSessionData {
  symbol: string;
  investmentKRW: number;
  investmentUSDT: number;
  expectedProfit: number;
  upbitPrice: number;
  binancePrice: number;
  rate: number;
  executedAt: Date;
}

export interface LowPremiumSessionData {
  requiredProfit: number;
  allowedLoss: number;
  searchStartTime: Date;
  targetSymbol?: string;
}

export enum SessionStatus {
  IDLE = 'IDLE',
  NORMAL_PROCESSING = 'NORMAL_PROCESSING', // 고프리미엄 처리
  REVERSE_PROCESSING = 'REVERSE_PROCESSING', // 저프리미엄 처리
  HIGH_PREMIUM_PROCESSING = 'HIGH_PREMIUM_PROCESSING', // 기존 호환성
  AWAITING_LOW_PREMIUM = 'AWAITING_LOW_PREMIUM', // 기존 호환성
  LOW_PREMIUM_PROCESSING = 'LOW_PREMIUM_PROCESSING', // 기존 호환성
  AWAITING_SECOND_STEP = 'AWAITING_SECOND_STEP', // 2단계 대기
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
