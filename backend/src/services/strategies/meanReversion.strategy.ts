import type { IGateSettings } from '../../models/User';
import { gateService } from '../gate.service';
import {
  clampContractsByBalance,
  computeContractNotional,
  ensureContractSize,
  evaluateRiskFromCandle,
  getAvailableNotional,
  resolveContractSpecs,
  RiskConfig,
  clampLeverageValue,
  logBacktestTrade,
  calculatePositionMetrics,
} from './helpers';

const getCandleClose = (candle: any): number | null => {
  if (!candle) return null;
  if (Array.isArray(candle)) {
    const close = Number(candle[2] ?? candle[1] ?? candle[3]);
    return Number.isFinite(close) ? close : null;
  }
  if (typeof candle === 'object') {
    const close = Number(candle.close ?? candle.c ?? candle.last ?? candle.mark_price);
    return Number.isFinite(close) ? close : null;
  }
  return null;
};

const getCandleHigh = (candle: any): number | null => {
  if (!candle) return null;
  if (Array.isArray(candle)) {
    const high = Number(candle[3] ?? candle[2] ?? candle[1]);
    return Number.isFinite(high) ? high : null;
  }
  if (typeof candle === 'object') {
    const high = Number(candle.high ?? candle.h ?? candle.close ?? candle.c);
    return Number.isFinite(high) ? high : null;
  }
  return null;
};

const getCandleLow = (candle: any): number | null => {
  if (!candle) return null;
  if (Array.isArray(candle)) {
    const low = Number(candle[4] ?? candle[3] ?? candle[2]);
    return Number.isFinite(low) ? low : null;
  }
  if (typeof candle === 'object') {
    const low = Number(candle.low ?? candle.l ?? candle.close ?? candle.c);
    return Number.isFinite(low) ? low : null;
  }
  return null;
};

const getCandleTime = (candle: any): number => {
  if (Array.isArray(candle)) {
    const raw = Number(candle[0]) || Date.now();
    return raw > 1e12 ? raw : raw * 1000;
  }
  if (typeof candle === 'object') {
    const raw = Number(candle.t ?? candle.time ?? candle.timestamp ?? Date.now());
    return raw > 1e12 ? raw : raw * 1000;
  }
  return Date.now();
};

const calcMean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / (values.length || 1);

const calcStd = (values: number[], mean: number) => {
  if (values.length <= 1) return 0;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
};

export interface MeanReversionParams {
  strategyId?: string;
  settle: string;
  contract: string;
  interval: string;
  lookback: number;
  threshold: number;
  baseSize: number;
  autoExecute: boolean;
  gateSettings: IGateSettings;
  useTestnet?: boolean;
  leverage?: number;
}

export const runMeanReversionStrategy = async (
  params: MeanReversionParams
) => {
  const {
    settle,
    contract,
    interval,
    lookback,
    threshold,
    baseSize,
    autoExecute,
    gateSettings,
    useTestnet,
  } = params;

  const candleLimit = Math.min(Math.max(Number(lookback) || 50, 20), 300);

  const [candles, account, contractDetail]: [any[], any, any] = await Promise.all([
    gateService.getCandlesticks(settle, contract, interval, candleLimit, { useTestnet }),
    gateService.getAccount(settle, gateSettings, { useTestnet }),
    gateService.getContractDetail(settle, contract, { useTestnet }),
  ]);

  const availableNotional = getAvailableNotional(account);
  const { multiplier: contractMultiplier, minContracts, maxLeverage } = resolveContractSpecs(contractDetail);
  const contractSize = contractMultiplier;
  const normalizedLeverage = clampLeverageValue(params.leverage, maxLeverage);

  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error('无法获取历史K线数据');
  }

  const closes = candles
    .map((candle) => getCandleClose(candle))
    .filter((value): value is number => Number.isFinite(value));

  if (closes.length < 10) {
    throw new Error('K线数据不足以运行策略');
  }

  const meanPrice = calcMean(closes);
  const stdDeviation = calcStd(closes, meanPrice);
  const lastPrice = closes[closes.length - 1];
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    if (prev > 0) {
      returns.push(Math.log(closes[i] / prev));
    }
  }
  const meanReturn = returns.length ? calcMean(returns) : 0;
  const returnStd = returns.length ? calcStd(returns, meanReturn) : 0;
  const VAR_Z = 1.6448536269514722; // 95% VaR
  const valueAtRisk = meanReturn + returnStd * VAR_Z;

  const zScore = stdDeviation ? (lastPrice - meanPrice) / stdDeviation : 0;
  const absZ = Math.abs(zScore);
  const normalizedThreshold = Math.max(Number(threshold) || 1, 0.2);
  const shouldTrade = absZ >= normalizedThreshold;
  const action = shouldTrade ? (zScore > 0 ? 'short' : 'long') : 'hold';
  const confidence = Math.min(0.99, absZ / normalizedThreshold);

  const normalizedBaseContracts = ensureContractSize(baseSize, minContracts);
  const scaleFactor = Math.min(Math.max(absZ, 1), 5);
  const requestedContracts = shouldTrade
    ? ensureContractSize(normalizedBaseContracts * scaleFactor, minContracts)
    : 0;
  const requestedNotional = computeContractNotional(requestedContracts, lastPrice, contractMultiplier);
  const appliedContracts = clampContractsByBalance(
    requestedContracts,
    availableNotional,
    lastPrice,
    contractMultiplier,
    { leverage: normalizedLeverage }
  );
  const appliedNotional = computeContractNotional(appliedContracts, lastPrice, contractMultiplier);
  const finalShouldTrade = shouldTrade && appliedContracts > 0;

  const directionalSize = finalShouldTrade
    ? action === 'long'
      ? appliedContracts
      : -appliedContracts
    : 0;

  const orderPayload = directionalSize
    ? {
        settle,
        contract,
        size: directionalSize.toString(),
        price: '0',
        tif: 'ioc',
      }
    : null;

  let executedOrder: any = null;
  if (autoExecute && orderPayload) {
    if (normalizedLeverage) {
      await gateService.updatePositionLeverage(settle, contract, normalizedLeverage, gateSettings, {
        useTestnet,
      });
    }
    executedOrder = await gateService.createOrder(settle, orderPayload, gateSettings, { useTestnet });
  }

  return {
    strategy: {
      name: 'mean-reversion',
      interval,
      lookback: candleLimit,
      threshold: normalizedThreshold,
      action,
      shouldTrade: finalShouldTrade,
      confidence,
      zScore,
      recommendedSize: appliedContracts,
      recommendedNotional: appliedNotional,
      autoExecuted: autoExecute,
      requestedNotional,
      appliedNotional,
      contractSize,
      leverageLimit: maxLeverage,
      appliedLeverage: normalizedLeverage ?? 1,
    },
    market: {
      contract,
      settle,
      lastPrice,
      meanPrice,
      stdDeviation,
      valueAtRisk,
    },
    account: {
      total: account?.total,
      position_margin: account?.position_margin,
      maintenance_rate: account?.maintenance_rate,
    },
    order: orderPayload,
    execution: executedOrder
      ? {
          status: 'executed' as const,
          id: executedOrder?.id,
          text: executedOrder?.text,
        }
      : {
          status: orderPayload ? ('ready' as const) : ('idle' as const),
        },
  };
};

export const backtestMeanReversion = (params: {
  bars: any[];
  lookback: number;
  threshold: number;
  baseSize: number;
  initialCapital: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
  contractSize?: number;
}) => {
  const {
    bars,
    lookback,
    threshold,
    baseSize,
    initialCapital,
    takeProfitPct,
    stopLossPct,
    leverage,
    contractSize,
  } = params;
  const closes: number[] = [];
  const times: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  bars.forEach((candle: any) => {
    const close = getCandleClose(candle);
    if (close !== null) {
      closes.push(close);
      times.push(getCandleTime(candle));
      const high = getCandleHigh(candle);
      const low = getCandleLow(candle);
      highs.push(high ?? close);
      lows.push(low ?? close);
    }
  });
  const trades: any[] = [];
  const initialEquity = Number(initialCapital) || 0;
  let equity = initialEquity;
  const equityCurve: { time: number; value: number }[] = [];
  let openPos: { direction: 'long' | 'short'; price: number; time: number; qty: number } | null = null;
  const leverageValue = leverage && leverage > 0 ? leverage : 1;
  const riskConfig: RiskConfig | undefined = takeProfitPct || stopLossPct
    ? { takeProfitPct, stopLossPct, leverage: leverageValue }
    : undefined;

  const closePosition = (exitPrice: number, exitTime: number) => {
    if (!openPos) return;
    const { direction, price: entryPrice, qty, time: entryTime } = openPos;
    const { multiplier, pnl, notional, returnPct } = calculatePositionMetrics(
      direction,
      entryPrice,
      exitPrice,
      qty,
      contractSize,
      leverageValue
    );
    equity += pnl;
    const tradeRecord = {
      _id: `${exitTime}-${trades.length}`,
      direction,
      size: qty,
      notional,
      entryPrice,
      exitPrice,
      entryTime: new Date(entryTime),
      exitTime: new Date(exitTime),
      pnl,
      returnPct,
      contractSize: multiplier,
    };
    trades.push(tradeRecord);
    logBacktestTrade('mean-reversion', tradeRecord);
    equityCurve.push({ time: exitTime, value: equity });
    openPos = null;
  };
  const normalizedThreshold = Math.max(Number(threshold) || 1, 0.2);

  const calcWindowStats = (index: number) => {
    const start = Math.max(0, index - lookback + 1);
    const window = closes.slice(start, index + 1);
    const mean = calcMean(window);
    const std = calcStd(window, mean);
    return { mean, std };
  };

  for (let i = lookback; i < closes.length; i += 1) {
    const { mean, std } = calcWindowStats(i);
    const price = closes[i];
    const time = times[i];
    if (openPos && riskConfig) {
      const decision = evaluateRiskFromCandle(openPos.direction, openPos.price, { high: highs[i], low: lows[i] }, riskConfig);
      if (decision) {
        closePosition(decision.exitPrice, time);
        continue;
      }
    }
    const zScore = std ? (price - mean) / std : 0;
    const absZ = Math.abs(zScore);
    const shouldTrade = absZ >= normalizedThreshold;
    if (!shouldTrade) continue;
    const direction = zScore > 0 ? 'short' : 'long';
    if (!openPos) {
      const baseContracts = Math.max(Math.floor(Number(baseSize) || 1), 1);
      const scaledContracts = Math.max(1, Math.floor(baseContracts * Math.min(absZ, 5)));
      const qty = scaledContracts;
      openPos = { direction, price, time, qty };
      continue;
    }
    if (openPos.direction !== direction) {
      closePosition(price, time);
      const baseContracts = Math.max(Math.floor(Number(baseSize) || 1), 1);
      const scaledContracts = Math.max(1, Math.floor(baseContracts * Math.min(absZ, 5)));
      const nextQty = scaledContracts;
      openPos = { direction, price, time, qty: nextQty };
    }
  }

  const wins = trades.filter((t) => t.pnl >= 0).length;
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalReturn = initialEquity ? (equity - initialEquity) / initialEquity : 0;

  return {
    stats: {
      totalPnL,
      totalReturn,
      winTrades: wins,
      lossTrades: trades.length - wins,
      tradeCount: trades.length,
      initialCapital: initialEquity,
      finalEquity: equity,
    },
    trades,
    equityCurve,
  };
};
