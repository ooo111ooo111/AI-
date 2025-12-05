import api from './api';
import type { Analysis, AnalysisListResponse, StatsResponse } from '../types';

export const analysisService = {
  // 上传图片并分析
  createAnalysis: async (formData: FormData): Promise<Analysis> => {
    const response = await api.post<Analysis>('/analyses', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 获取分析列表
  getAnalyses: async (params?: {
    page?: number;
    limit?: number;
    symbol?: string;
  }): Promise<AnalysisListResponse> => {
    const response = await api.get<AnalysisListResponse>('/analyses', { params });
    return response.data;
  },

  // 获取单个分析
  getAnalysisById: async (id: string): Promise<Analysis> => {
    const response = await api.get<Analysis>(`/analyses/${id}`);
    return response.data;
  },

  // 删除分析
  deleteAnalysis: async (id: string): Promise<void> => {
    await api.delete(`/analyses/${id}`);
  },

  // 获取统计数据
  getStats: async (): Promise<StatsResponse> => {
    const response = await api.get<StatsResponse>('/analyses/stats');
    return response.data;
  },
};
