export const SUPPORTED_SYMBOLS = [
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ' },
  { symbol: 'BNB', name: 'Binance Coin', icon: 'BNB' },
  { symbol: 'SOL', name: 'Solana', icon: 'SOL' },
  { symbol: 'XRP', name: 'Ripple', icon: 'XRP' },
  { symbol: 'ADA', name: 'Cardano', icon: 'ADA' },
  { symbol: 'DOGE', name: 'Dogecoin', icon: 'Ð' },
  { symbol: 'MATIC', name: 'Polygon', icon: 'MATIC' },
  { symbol: 'DOT', name: 'Polkadot', icon: 'DOT' },
  { symbol: 'AVAX', name: 'Avalanche', icon: 'AVAX' }
];

export const getTrendLabel = (trend: string): string => {
  const labels: Record<string, string> = {
    bullish: '看涨',
    bearish: '看跌',
    neutral: '中性'
  };
  return labels[trend] || trend;
};

export const getRiskLabel = (risk: string): string => {
  const labels: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险'
  };
  return labels[risk] || risk;
};
