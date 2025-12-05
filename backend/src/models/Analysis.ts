import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalysis extends Document {
  symbol: string;
  imagePath: string;
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
      required: true
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
    timeframe: String
  },
  { timestamps: true }
);

// 索引
AnalysisSchema.index({ symbol: 1, createdAt: -1 });
AnalysisSchema.index({ createdAt: -1 });

export default mongoose.model<IAnalysis>('Analysis', AnalysisSchema);
