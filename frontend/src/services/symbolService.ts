import api from './api';
import type { CryptoSymbol } from '../types';

export const symbolService = {
  // 获取支持的币种列表
  getSymbols: async (): Promise<CryptoSymbol[]> => {
    const response = await api.get<{ symbols: CryptoSymbol[] }>('/symbols');
    return response.data.symbols;
  },
};
