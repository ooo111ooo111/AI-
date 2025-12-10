import StrategyInstance from '../models/StrategyInstance';
import StrategyTrade from '../models/StrategyTrade';
import { evaluateRiskFromPrice, RiskConfig } from './strategies/helpers';

interface StrategyResultPayload {
  strategy: {
    action: 'long' | 'short' | 'hold';
    shouldTrade?: boolean;
    signalTriggered?: boolean;
    recommendedSize?: number;
    recommendedNotional?: number;
    appliedNotional?: number;
    autoExecuted?: boolean;
    contractSize?: number;
  };
  market: {
    lastPrice: number;
  };
  execution?: {
    status: 'executed' | 'ready' | 'idle';
  };
}

export const handleStrategyPerformance = async (
  instanceId: string,
  userId: string,
  strategyId: string,
  payload: StrategyResultPayload
) => {
  const { strategy, market, execution } = payload;
  const instance = await StrategyInstance.findById(instanceId);
  if (!instance) return;

  const price = Number(market?.lastPrice || 0);
  if (!price || !Number.isFinite(price)) return;

  const leverageValue =
    instance.config?.leverage && instance.config.leverage > 0 ? instance.config.leverage : 1;

  const riskConfig: RiskConfig | undefined = instance.config
    ? {
        takeProfitPct: instance.config.takeProfitPct,
        stopLossPct: instance.config.stopLossPct,
        leverage: leverageValue,
      }
    : undefined;
  const autoExecuted = execution?.status === 'executed';
  const resultContractSize = strategy?.contractSize || instance.openPosition?.contractSize;
  const contractSize = resultContractSize && resultContractSize > 0 ? resultContractSize : 1;
  let dirty = false;

  const recordTrade = async (
    position: NonNullable<typeof instance.openPosition>,
    exitPrice: number,
    exitTime = new Date()
  ) => {
    const qty = Math.abs(Number(position.size || 0));
    if (!qty || !Number.isFinite(qty)) {
      return;
    }
    const direction = position.direction;
    const entryPrice = Number(position.entryPrice || 0);
    if (!entryPrice) {
      return;
    }
    const pnl =
      direction === 'long'
        ? (exitPrice - entryPrice) * qty
        : (entryPrice - exitPrice) * qty;
    const notional = Math.max(entryPrice * qty, 1e-8);
    const requestedNotional = position.requestedNotional ?? notional;
    const marginBasis = leverageValue > 0 ? notional / leverageValue : notional;
    const returnPct = marginBasis ? pnl / marginBasis : 0;

    await StrategyTrade.create({
      instanceId,
      userId,
      strategyId,
      direction,
      size: qty,
      notional,
      requestedNotional,
      entryPrice,
      exitPrice,
      entryTime: position.entryTime,
      exitTime,
      pnl,
      returnPct,
      autoExecuted,
      contractSize: position.contractSize || contractSize || 1,
    });

    const performance = instance.performance || {
      totalPnL: 0,
      totalReturn: 0,
      winTrades: 0,
      lossTrades: 0,
      tradeCount: 0,
    };
    performance.totalPnL += pnl;
    performance.totalReturn += returnPct;
    performance.tradeCount += 1;
    if (pnl >= 0) performance.winTrades += 1;
    else performance.lossTrades += 1;
    instance.performance = performance;
    dirty = true;
  };

  const openPosition = instance.openPosition;
  if (openPosition && openPosition.entryTime && openPosition.size) {
    const riskDecision = evaluateRiskFromPrice(
      openPosition.direction,
      openPosition.entryPrice,
      price,
      riskConfig
    );
    if (riskDecision) {
      await recordTrade(openPosition, riskDecision.exitPrice);
      instance.openPosition = null;
      dirty = true;
    }
  }

  if (!strategy?.shouldTrade || strategy.action === 'hold') {
    if (dirty) {
      await instance.save();
    }
    return;
  }

  const size = Math.abs(Number(strategy.recommendedSize || 0));
  if (!size || !Number.isFinite(size)) {
    if (dirty) {
      await instance.save();
    }
    return;
  }

  const direction = strategy.action === 'short' ? 'short' : 'long';
  const orderNotional = Number(strategy.recommendedNotional || strategy.appliedNotional || 0) || undefined;
  const nextOpen = instance.openPosition;

  if (!nextOpen || !nextOpen.entryTime || nextOpen.size === 0) {
    instance.openPosition = {
      direction,
      size,
      entryPrice: price,
      entryTime: new Date(),
      notional: price * size,
      requestedNotional: orderNotional,
      leverage: leverageValue,
      contractSize,
    };
    dirty = true;
  } else if (nextOpen.direction === direction) {
    const totalNotional = nextOpen.entryPrice * nextOpen.size + price * size;
    const totalSize = nextOpen.size + size;
    const avgEntry = totalSize ? totalNotional / totalSize : price;
    instance.openPosition = {
      direction,
      size: totalSize,
      entryPrice: avgEntry,
      entryTime: nextOpen.entryTime,
      notional: totalNotional,
      requestedNotional: (nextOpen.requestedNotional || 0) + (orderNotional || price * size),
      leverage: leverageValue,
      contractSize,
    };
    dirty = true;
  } else {
    await recordTrade(nextOpen, price);
    instance.openPosition = {
      direction,
      size,
      entryPrice: price,
      entryTime: new Date(),
      notional: price * size,
      requestedNotional: orderNotional,
      leverage: leverageValue,
      contractSize,
    };
    dirty = true;
  }

  if (dirty) {
    await instance.save();
  }
};

export const getInstancePerformance = async (instanceId: string) => {
  const instance = await StrategyInstance.findById(instanceId).lean();
  if (!instance) return null;
  const trades = await StrategyTrade.find({ instanceId })
    .sort({ exitTime: -1 })
    .limit(20)
    .lean();
  const stats = instance.performance || {
    totalPnL: 0,
    totalReturn: 0,
    winTrades: 0,
    lossTrades: 0,
    tradeCount: 0,
  };
  const winRate = stats.tradeCount
    ? Number(((stats.winTrades / stats.tradeCount) * 100).toFixed(2))
    : 0;
  const avgReturn = stats.tradeCount
    ? Number((stats.totalReturn / stats.tradeCount).toFixed(4))
    : 0;
  return {
    stats: {
      totalPnL: stats.totalPnL,
      totalReturn: stats.totalReturn,
      winTrades: stats.winTrades,
      lossTrades: stats.lossTrades,
      tradeCount: stats.tradeCount,
      winRate,
      avgReturn,
      openPosition: instance.openPosition || null,
    },
    trades,
  };
};
