import mongoose, { Schema, Document } from 'mongoose';

export interface IStrategyTrade extends Document {
  instanceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  strategyId: string;
  direction: 'long' | 'short';
  size: number;
  notional: number;
  requestedNotional: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  pnl: number;
  returnPct: number;
  autoExecuted: boolean;
  contractSize?: number;
}

const StrategyTradeSchema = new Schema<IStrategyTrade>(
  {
    instanceId: { type: Schema.Types.ObjectId, ref: 'StrategyInstance', index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    strategyId: { type: String, required: true },
    direction: { type: String, enum: ['long', 'short'], required: true },
    size: { type: Number, required: true },
    notional: { type: Number, default: 0 },
    requestedNotional: { type: Number, default: 0 },
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, required: true },
    entryTime: { type: Date, required: true },
    exitTime: { type: Date, required: true },
    pnl: { type: Number, required: true },
    returnPct: { type: Number, required: true },
    autoExecuted: { type: Boolean, default: false },
    contractSize: { type: Number, default: 1 },
  },
  { timestamps: true }
);

StrategyTradeSchema.index({ instanceId: 1, exitTime: -1 });

export default mongoose.model<IStrategyTrade>('StrategyTrade', StrategyTradeSchema);
