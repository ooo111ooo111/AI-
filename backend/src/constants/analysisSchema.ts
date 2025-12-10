export const ANALYSIS_SCHEMA_DESCRIPTION = `{
  "trend": "bullish | bearish | neutral",
  "confidence": number,
  "keyLevels": {
    "support": number[],
    "resistance": number[]
  },
  "indicators": {
    "rsi": number,
    "macd": string,
    "volume": string,
    "movingAverages": string
  },
  "analysis": string,
  "recommendation": string,
  "riskLevel": "low | medium | high",
  "timeframe": string,
  "strategyDetails": {
    "name": string,
    "description": string,
    "holdingPeriod": string,
    "keyIndicators": string[]
  }
}`;
