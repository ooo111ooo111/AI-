export interface CryptoSymbol {
  symbol: string;
  name: string;
  icon: string;
}

export type StrategyType = 'long-term' | 'short-term';

export interface StrategyDetails {
  name: string;
  description: string;
  holdingPeriod: string;
  keyIndicators: string[];
}

export interface Analysis {
  _id: string;
  symbol: string;
  imageUrl: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  indicators: {
    rsi?: number;
    macd?: string;
    volume?: string;
    movingAverages?: string;
  };
  analysis: string;
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high';
  timeframe?: string;
  strategyType: StrategyType;
  strategyDetails?: StrategyDetails;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisListResponse {
  analyses: Analysis[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface StatsResponse {
  total: number;
  byTrend: Array<{
    _id: string;
    count: number;
  }>;
  bySymbol: Array<{
    _id: string;
    count: number;
  }>;
}

export interface InvitationStatus {
  hasAccess: boolean;
  invitationCode?: string;
  grantedAt?: string;
  meta?: {
    description?: string;
    remaining?: number;
  };
}

export interface QuantStatus {
  hasAccess: boolean;
  invitationCode?: string;
  grantedAt?: string;
  gate: {
    isConnected: boolean;
    nickname?: string;
    updatedAt?: string;
  };
}

export interface GateContract {
  name: string;
  type?: string;
  quanto_multiplier?: string;
  mark_price?: string;
  funding_rate?: string;
  [key: string]: any;
}

export interface GateAccountInfo {
  total?: Record<string, any> | string;
  margin_balance?: string;
  cross_margin_balance?: string;
  available?: string;
  cross_available?: string;
  position_margin?: string;
  position_initial_margin?: string;
  maintenance_rate?: string;
  maintenance_margin?: string;
  cross_maintenance_margin?: string;
  cross_initial_margin?: string;
  order_margin?: string;
  cross_order_margin?: string;
  cross_unrealised_pnl?: string;
  unrealised_pnl?: string;
  realised_pnl?: string;
  margin_mode_name?: string;
  margin_mode?: number | string;
  [key: string]: any;
}

export interface GatePosition {
  contract: string;
  size: string;
  entry_price?: string;
  mark_price?: string;
  leverage?: string;
  mode?: string;
  realised_point?: string;
  margin?: string;
  position_margin?: string;
  initial_margin?: string;
  maintenance_margin?: string;
  maintenance_rate?: string;
  mmr?: string;
  liq_price?: string;
  unrealised_pnl?: string;
  unrealised_pnl_rate?: string;
  pnl_rate?: string;
  pnl?: string;
  value?: string;
  cross_leverage_limit?: string;
  leverage_max?: string;
  position_id?: string;
  [key: string]: any;
}

export interface GateOrderPayload {
  settle?: string;
  contract: string;
  size: string | number;
  price?: string | number;
  tif?: string;
  reduceOnly?: boolean;
  close?: boolean;
}

export interface StrategyInstanceConfig {
  settle: string;
  contract: string;
  interval: string;
  lookback: number;
  threshold: number;
  baseSize: number;
  autoExecute: boolean;
  frequencyMs: number;
  useHeikinAshi?: boolean;
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
}

export interface StrategyInstance {
  _id: string;
  user: string;
  strategyId: string;
  status: 'running' | 'stopped';
  config: StrategyInstanceConfig;
  lastRunAt?: string;
  lastSignal?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuantStrategyDetails {
  name: string;
  interval: string;
  lookback?: number;
  threshold?: number;
  action: 'long' | 'short' | 'hold';
  shouldTrade?: boolean;
  signalTriggered?: boolean;
  confidence?: number;
  zScore?: number;
  totalScore?: number;
  status?: string;
  isScalping?: boolean;
  isPrime?: boolean;
  entryQuality?: number;
  session?: {
    name: string;
    quality: string;
  };
  recommendedSize?: number;
  recommendedNotional?: number;
  requestedNotional?: number;
  appliedNotional?: number;
  autoExecuted?: boolean;
  leverageLimit?: number;
  appliedLeverage?: number;
  contractSize?: number;
}

export interface QuantStrategyMarketSnapshot {
  contract: string;
  settle: string;
  lastPrice: number;
  meanPrice: number;
  stdDeviation: number;
  valueAtRisk: number;
}

export interface QuantStrategyExecution {
  status: 'executed' | 'ready' | 'idle';
  id?: string;
  text?: string;
}

export interface QuantStrategyRunResponse {
  strategyId?: string;
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
  strategy: QuantStrategyDetails;
  market: QuantStrategyMarketSnapshot & {
    equilibrium?: number;
    fibEntry?: number;
    trail?: number;
  };
  account?: Partial<GateAccountInfo>;
  order?: {
    settle: string;
    contract: string;
    size: string;
    tif?: string;
  } | null;
  execution: QuantStrategyExecution;
}

export type StrategyEvent =
  | {
      type: 'strategy:run';
      instanceId: string;
      userId: string;
      payload: QuantStrategyRunResponse;
    }
  | {
      type: 'strategy:error';
      instanceId: string;
      userId: string;
      error: string;
    }
  | {
      type: 'strategy:status';
      instanceId: string;
      userId: string;
      status: string;
    };

export interface AdminUserSummary {
  id: string;
  email?: string;
  nickname: string;
  createdAt: string;
  lastLoginAt?: string;
  quantAccess?: {
    hasAccess: boolean;
    invitationCode?: string;
    grantedAt?: string;
  };
  providers?: string[];
}

export interface AdminUserListResponse {
  users: AdminUserSummary[];
}

export interface InvitationGenerateResponse {
  message: string;
  codes: string[];
}

export interface InvitationCodeSummary {
  _id: string;
  code: string;
  description?: string;
  maxRedemptions?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  createdBy?: string;
}

export interface InvitationListResponse {
  invitations: InvitationCodeSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface HotTweet {
  _id: string;
  tweetId: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  text: string;
  postedAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  url: string;
  keywords?: string[];
}

export interface StrategyTradeSummary {
  _id?: string;
  direction: 'long' | 'short';
  size: number;
  notional?: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  pnl: number;
  returnPct: number;
  autoExecuted: boolean;
  contractSize?: number;
}

export interface StrategyPerformanceStats {
  totalPnL: number;
  totalReturn: number;
  winTrades: number;
  lossTrades: number;
  tradeCount: number;
  winRate: number;
  avgReturn: number;
  openPosition?: {
    direction: 'long' | 'short';
    size: number;
    entryPrice: number;
    entryTime: string;
    contractSize?: number;
  } | null;
  initialCapital?: number;
  finalEquity?: number;
}

export interface StrategyPerformanceResponse {
  stats: StrategyPerformanceStats;
  trades: StrategyTradeSummary[];
}

export interface StrategyRunLog {
  _id: string;
  instance: string;
  strategyId: string;
  status: 'running' | 'success' | 'error';
  action?: string;
  shouldTrade?: boolean;
  autoExecute?: boolean;
  orderSize?: number;
  orderNotional?: number;
  orderId?: string;
  errorMessage?: string;
  snapshot?: Record<string, any> | null;
  startedAt: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BacktestResponse {
  strategyId: string;
  settle: string;
  contract: string;
  interval: string;
  startTime: number;
  endTime: number;
  initialCapital: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
  stats: StrategyPerformanceStats;
  trades: StrategyTradeSummary[];
  equityCurve?: { time: number; value: number }[];
}
