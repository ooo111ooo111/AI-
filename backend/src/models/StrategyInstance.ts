import mongoose, { Schema, Document } from 'mongoose';

export type StrategyStatus = 'running' | 'stopped';

export interface IStrategyConfig {
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

export interface IStrategyInstance extends Document {
  user: mongoose.Types.ObjectId;
  strategyId: string;
  status: StrategyStatus;
  config: IStrategyConfig;
  lastRunAt?: Date;
  lastSignal?: string;
  openPosition?: {
    direction: 'long' | 'short';
    size: number;
    entryPrice: number;
    entryTime: Date;
    notional?: number;
    requestedNotional?: number;
    leverage?: number;
    contractSize?: number;
  } | null;
  performance?: {
    totalPnL: number;
    totalReturn: number;
    winTrades: number;
    lossTrades: number;
    tradeCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const StrategyConfigSchema = new Schema<IStrategyConfig>(
  {
    settle: { type: String, default: 'usdt' },
    contract: { type: String, required: true },
    interval: { type: String, default: '5m' },
    lookback: { type: Number, default: 50 },
    threshold: { type: Number, default: 1 },
    baseSize: { type: Number, default: 1 },
    autoExecute: { type: Boolean, default: false },
    frequencyMs: { type: Number, default: 60000 },
    useHeikinAshi: { type: Boolean, default: false },
    takeProfitPct: { type: Number, min: 0 },
    stopLossPct: { type: Number, min: 0 },
    leverage: { type: Number, min: 1 },
  },
  { _id: false }
);

const StrategyInstanceSchema = new Schema<IStrategyInstance>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    strategyId: { type: String, required: true },
    status: { type: String, enum: ['running', 'stopped'], default: 'running' },
    config: { type: StrategyConfigSchema, required: true },
    lastRunAt: { type: Date },
    lastSignal: { type: String },
    openPosition: {
      direction: { type: String, enum: ['long', 'short'] },
      size: { type: Number },
      entryPrice: { type: Number },
      entryTime: { type: Date },
      notional: { type: Number },
      requestedNotional: { type: Number },
      leverage: { type: Number, min: 1 },
      contractSize: { type: Number, min: 0 },
    },
    performance: {
      totalPnL: { type: Number, default: 0 },
      totalReturn: { type: Number, default: 0 },
      winTrades: { type: Number, default: 0 },
      lossTrades: { type: Number, default: 0 },
      tradeCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

StrategyInstanceSchema.index({ user: 1, strategyId: 1, 'config.contract': 1 });

export default mongoose.model<IStrategyInstance>('StrategyInstance', StrategyInstanceSchema);
