export interface CryptoSymbol {
  symbol: string;
  name: string;
  icon: string;
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
