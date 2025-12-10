import api from './api';
import type {
  GateAccountInfo,
  GateContract,
  GateOrderPayload,
  GatePosition,
  QuantStatus,
  QuantStrategyRunResponse,
  StrategyInstance,
  StrategyPerformanceResponse,
  StrategyRunLog,
  BacktestResponse,
} from '../types';

export const quantService = {
  getStatus: async (): Promise<QuantStatus> => {
    const response = await api.get<QuantStatus>('/quant/status');
    return response.data;
  },

  saveGateCredentials: async (payload: {
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    nickname?: string;
  }): Promise<{ message: string; gate: QuantStatus['gate'] }> => {
    const response = await api.post<{ message: string; gate: QuantStatus['gate'] }>(
      '/quant/gate/credentials',
      payload
    );
    return response.data;
  },

  deleteGateCredentials: async (): Promise<void> => {
    await api.delete('/quant/gate/credentials');
  },

  getContractDetail: async (settle: string, contract: string): Promise<GateContract> => {
    const response = await api.get<GateContract>('/quant/gate/contracts', {
      params: { settle, contract }
    });
    return response.data;
  },

  getAccount: async (settle: string): Promise<GateAccountInfo> => {
    const response = await api.get<GateAccountInfo>('/quant/gate/account', {
      params: { settle }
    });
    return response.data;
  },

  getPositions: async (settle: string): Promise<GatePosition[]> => {
    const response = await api.get<GatePosition[]>('/quant/gate/positions', {
      params: { settle }
    });
    return response.data;
  },

  createOrder: async (payload: GateOrderPayload) => {
    const response = await api.post('/quant/gate/orders', payload);
    return response.data;
  },

  runStrategy: async (payload: {
    settle?: string;
    contract: string;
    interval?: string;
    lookback?: number;
    threshold?: number;
    baseSize?: number;
    autoExecute?: boolean;
    strategyId?: string;
    useHeikinAshi?: boolean;
    takeProfitPct?: number;
    stopLossPct?: number;
    leverage?: number;
  }): Promise<QuantStrategyRunResponse> => {
    const response = await api.post<QuantStrategyRunResponse>('/quant/gate/strategy/run', payload);
    return response.data;
  },

  getStrategyInstances: async (): Promise<StrategyInstance[]> => {
    const response = await api.get<StrategyInstance[]>('/quant/strategies/instances');
    return response.data;
  },

  createStrategyInstance: async (payload: {
    strategyId: string;
    settle: string;
    contract: string;
    interval: string;
    lookback: number;
    threshold: number;
    baseSize: number;
    autoExecute: boolean;
    frequencyMs?: number;
    useHeikinAshi?: boolean;
    takeProfitPct?: number;
    stopLossPct?: number;
    leverage?: number;
  }): Promise<StrategyInstance> => {
    const response = await api.post<StrategyInstance>('/quant/strategies/instances', payload);
    return response.data;
  },

  createGateOrder: async (payload: {
    settle: string;
    contract: string;
    size: string;
    price?: string;
    tif?: 'gtc' | 'ioc' | 'poc' | 'fok';
    reduceOnly?: boolean;
    close?: boolean;
    stpAct?: 'cn' | 'co' | 'cb';
  }) => {
    const response = await api.post('/quant/gate/orders', payload);
    return response.data;
  },

  startStrategyInstance: async (id: string): Promise<void> => {
    await api.post(`/quant/strategies/instances/${id}/start`, {});
  },

  stopStrategyInstance: async (id: string): Promise<void> => {
    await api.post(`/quant/strategies/instances/${id}/stop`, {});
  },

  deleteStrategyInstance: async (id: string): Promise<void> => {
    await api.delete(`/quant/strategies/instances/${id}`);
  },

  getStrategyPerformance: async (id: string): Promise<StrategyPerformanceResponse> => {
    const response = await api.get<StrategyPerformanceResponse>(
      `/quant/strategies/instances/${id}/performance`
    );
    return response.data;
  },

  getStrategyRunLogs: async (id: string, limit = 50): Promise<StrategyRunLog[]> => {
    const response = await api.get<StrategyRunLog[]>(`/quant/strategies/instances/${id}/runs`, {
      params: { limit },
    });
    return response.data;
  },

  runBacktest: async (payload: {
    strategyId: string;
    settle: string;
    contract: string;
    interval: string;
    startTime: number;
    endTime: number;
    lookback: number;
    threshold: number;
    baseSize: number;
    useHeikinAshi?: boolean;
    takeProfitPct?: number;
    stopLossPct?: number;
    initialCapital?: number;
    leverage?: number;
  }): Promise<BacktestResponse> => {
    const response = await api.post<BacktestResponse>('/quant/backtest', payload);
    return response.data;
  },
};
