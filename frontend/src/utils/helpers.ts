import type { Analysis } from '../types';

export const getTrendColor = (trend: Analysis['trend']): string => {
  const colors = {
    bullish: 'text-green-500',
    bearish: 'text-red-500',
    neutral: 'text-gray-400',
  };
  return colors[trend];
};

export const getTrendBgColor = (trend: Analysis['trend']): string => {
  const colors = {
    bullish: 'bg-green-500/10 border-green-500/30',
    bearish: 'bg-red-500/10 border-red-500/30',
    neutral: 'bg-gray-500/10 border-gray-500/30',
  };
  return colors[trend];
};

export const getTrendLabel = (trend: Analysis['trend']): string => {
  const labels = {
    bullish: '看涨',
    bearish: '看跌',
    neutral: '中性',
  };
  return labels[trend];
};

export const getRiskColor = (risk: Analysis['riskLevel']): string => {
  const colors = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-red-400',
  };
  return colors[risk];
};

export const getRiskLabel = (risk: Analysis['riskLevel']): string => {
  const labels = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
  };
  return labels[risk];
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
