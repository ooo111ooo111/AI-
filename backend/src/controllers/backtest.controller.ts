import { RequestHandler } from 'express';
import {
  ensureQuantAccess,
  normalizeBaseContracts,
  normalizePercentValue,
  normalizeContractSymbol,
  resolveStrategyThreshold,
  normalizeLeverageValue,
} from './quant.controller';
import { fetchHistoricalCandles } from '../services/historical.service';
import { runBacktestByStrategy } from '../services/strategies';
import { isAdminEmail } from '../utils/admin.util';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { gateService } from '../services/gate.service';
import { clampLeverageValue, resolveContractSpecs } from '../services/strategies/helpers';

export const runStrategyBacktest: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await ensureQuantAccess(authReq.user!.userId);

    const {
      strategyId = 'sai-scalper',
      settle = 'usdt',
      contract,
      interval = '5m',
      startTime,
      endTime,
      lookback = 50,
      threshold = 1,
      baseSize = 1,
      useHeikinAshi = false,
      initialCapital = 1000,
      takeProfitPct,
      stopLossPct,
      leverage,
    } = req.body || {};

    if (!contract) {
      return res.status(400).json({ message: '请提供合约标识 (contract)' });
    }
    if (!startTime || !endTime || Number(startTime) >= Number(endTime)) {
      return res.status(400).json({ message: '请提供有效的起止时间' });
    }

    const rangeMs = Number(endTime) - Number(startTime);
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 365天
    if (rangeMs > maxRange) {
      return res.status(400).json({ message: '回测时间跨度不能超过 365 天' });
    }

    const normalizedContract = normalizeContractSymbol(contract, settle);
    const useTestnet = isAdminEmail(user.email);
    const [candles, contractDetail] = await Promise.all([
      fetchHistoricalCandles({
        settle,
        contract: normalizedContract,
        interval,
        startTime: Number(startTime),
        endTime: Number(endTime),
        useTestnet,
      }),
      gateService.getContractDetail(settle, normalizedContract, { useTestnet }),
    ]);

    if (!candles.length) {
      return res.status(400).json({ message: '选定区间内没有可用K线数据' });
    }

    const normalizedBaseSize = normalizeBaseContracts(baseSize);
    const normalizedTakeProfit = normalizePercentValue(takeProfitPct);
    const normalizedStopLoss = normalizePercentValue(stopLossPct);

    const { maxLeverage, multiplier } = resolveContractSpecs(contractDetail);
    const normalizedLeverage = clampLeverageValue(normalizeLeverageValue(leverage), maxLeverage);

    // 记录本次回测的关键入参，便于追踪回测/下单问题
    console.log('[Backtest] 回测请求参数', {
      userId: user._id?.toString?.() || user.id,
      email: user.email,
      strategyId,
      settle,
      contract: normalizedContract,
      interval,
      startTime,
      endTime,
      lookback,
      threshold,
      baseSize: normalizedBaseSize,
      useHeikinAshi,
      initialCapital,
      takeProfitPct: normalizedTakeProfit,
      stopLossPct: normalizedStopLoss,
      leverage: normalizedLeverage,
    });

    const result = runBacktestByStrategy({
      strategyId,
      bars: candles,
      interval,
      lookback: Number(lookback) || 50,
      threshold: resolveStrategyThreshold(strategyId, threshold),
      baseSize: normalizedBaseSize,
      useHeikinAshi,
      initialCapital: Number(initialCapital) || 0,
      takeProfitPct: normalizedTakeProfit,
      stopLossPct: normalizedStopLoss,
      leverage: normalizedLeverage,
      contractSize: multiplier,
    });

    res.json({
      strategyId,
      settle,
      contract: normalizedContract,
      interval,
      startTime,
      endTime,
      initialCapital: Number(initialCapital) || 0,
      takeProfitPct: normalizedTakeProfit,
      stopLossPct: normalizedStopLoss,
      leverage: normalizedLeverage,
      ...result,
    });
  } catch (error) {
    console.error('策略回测失败:', error);
    res.status(500).json({ message: (error as Error).message || '策略回测失败' });
  }
};
