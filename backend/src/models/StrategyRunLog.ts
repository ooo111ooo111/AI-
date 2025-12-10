import mongoose, { Schema, Document } from 'mongoose';

export type StrategyRunStatus = 'running' | 'success' | 'error';

export interface IStrategyRunLog extends Document {
  user: mongoose.Types.ObjectId;
  instance: mongoose.Types.ObjectId;
  strategyId: string;
  status: StrategyRunStatus;
  action?: string;
  shouldTrade?: boolean;
  autoExecute?: boolean;
  orderSize?: number;
  orderNotional?: number;
  orderId?: string;
  errorMessage?: string;
  snapshot?: Record<string, any> | null;
  startedAt: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StrategyRunLogSchema = new Schema<IStrategyRunLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    instance: { type: Schema.Types.ObjectId, ref: 'StrategyInstance', required: true, index: true },
    strategyId: { type: String, required: true },
    status: { type: String, enum: ['running', 'success', 'error'], default: 'running', index: true },
    action: { type: String },
    shouldTrade: { type: Boolean },
    autoExecute: { type: Boolean },
    orderSize: { type: Number },
    orderNotional: { type: Number },
    orderId: { type: String },
    errorMessage: { type: String },
    snapshot: { type: Schema.Types.Mixed },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

StrategyRunLogSchema.index({ instance: 1, startedAt: -1 });
StrategyRunLogSchema.index({ strategyId: 1, startedAt: -1 });

export default mongoose.model<IStrategyRunLog>('StrategyRunLog', StrategyRunLogSchema);
