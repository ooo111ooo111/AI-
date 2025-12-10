import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalysis extends Document {
  symbol: string;
  imagePath?: string;  // 本地存储模式下的文件路径(OSS模式下可选)
  imageUrl: string;    // 图片URL(本地或OSS)
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
  strategyType: 'long-term' | 'short-term';
  strategyDetails?: {
    name: string;
    description: string;
    holdingPeriod: string;
    keyIndicators: string[];
  };
  meta?: {
    ownerId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisSchema = new Schema<IAnalysis>(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    imagePath: {
      type: String,
      required: false  // OSS模式下不需要本地路径
    },
    imageUrl: {
      type: String,
      required: true
    },
    trend: {
      type: String,
      enum: ['bullish', 'bearish', 'neutral'],
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    keyLevels: {
      support: [Number],
      resistance: [Number]
    },
    indicators: {
      rsi: Number,
      macd: String,
      volume: String,
      movingAverages: String
    },
    analysis: {
      type: String,
      required: true
    },
    recommendation: {
      type: String,
      required: true
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true
    },
    timeframe: String,
    strategyType: {
      type: String,
      enum: ['long-term', 'short-term'],
      required: true,
      default: 'short-term'
    },
    strategyDetails: {
      name: String,
      description: String,
      holdingPeriod: String,
      keyIndicators: [String]
    },
    meta: {
      ownerId: String
    }
  },
  { timestamps: true }
);

// 索引
AnalysisSchema.index({ symbol: 1, createdAt: -1 });
AnalysisSchema.index({ createdAt: -1 });
AnalysisSchema.index({ 'meta.ownerId': 1, createdAt: -1 });

export default mongoose.model<IAnalysis>('Analysis', AnalysisSchema);
