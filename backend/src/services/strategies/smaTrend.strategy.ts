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
    const close = Number(candle[2] ?? candle[4] ?? candle[1]);
    return Number.isFinite(close) ? close : null;
  }
  if (typeof candle === 'object') {
    const close = Number(candle.close ?? candle.c ?? candle.last);
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

const calcMean = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

const calcStd = (values: number[], mean: number) => {
  if (values.length <= 1) return 0;
  const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
};

const sliceWindow = (values: number[], window: number, offset = 0) => {
  const end = values.length - offset;
  const start = end - window;
  if (start < 0 || end > values.length) {
    return null;
  }
  return values.slice(start, end);
};

const calcReturns = (values: number[]) => {
  const returns: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    const curr = values[i];
    if (Number.isFinite(prev) && Number.isFinite(curr) && prev !== 0) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
};

interface SmaTrendParams {
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
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
}

export const runSmaTrendStrategy = async (params: SmaTrendParams) => {
  const {
    strategyId = 'sma-trend',
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

  const normalizedLookback = Math.min(Math.max(Number(lookback) || 55, 20), 500);
  const normalizedThreshold = Math.max(Number(threshold) || 0.8, 0.1);

  const [candles, account, contractDetail]: [any[], any, any] = await Promise.all([
    gateService.getCandlesticks(settle, contract, interval, normalizedLookback * 3, { useTestnet }),
    gateService.getAccount(settle, gateSettings, { useTestnet }),
    gateService.getContractDetail(settle, contract, { useTestnet }),
  ]);

  if (!Array.isArray(candles) || candles.length < normalizedLookback + 5) {
    throw new Error('K线数据不足以运行单均线策略');
  }

  const closes = candles
    .map((candle) => getCandleClose(candle))
    .filter((value): value is number => Number.isFinite(value));

  if (closes.length < normalizedLookback + 2) {
    throw new Error('K线数据不足以运行单均线策略');
  }

  const lastPrice = closes[closes.length - 1];
  const lastWindow = sliceWindow(closes, normalizedLookback, 0);
  const prevWindow = sliceWindow(closes, normalizedLookback, 1);
  const meanPrice = lastWindow ? calcMean(lastWindow) : lastPrice;
  const prevMean = prevWindow ? calcMean(prevWindow) : meanPrice;
  const stdDeviation = calcStd(lastWindow ?? closes.slice(-normalizedLookback), meanPrice);
  const returns = calcReturns(closes.slice(-normalizedLookback * 2));
  const meanReturn = returns.length ? calcMean(returns) : 0;
  const returnStd = returns.length ? calcStd(returns, meanReturn) : 0;
  const VAR_Z = 1.6448536269; // 95%
  const valueAtRisk = meanReturn + returnStd * VAR_Z;

  const distancePct = meanPrice ? ((lastPrice - meanPrice) / meanPrice) * 100 : 0;
  const slopePct = prevMean ? ((meanPrice - prevMean) / prevMean) * 100 : 0;
  const bullish = distancePct >= normalizedThreshold && slopePct >= 0;
  const bearish = distancePct <= -normalizedThreshold && slopePct <= 0;
  const shouldTrade = bullish || bearish;
  const action: 'long' | 'short' | 'hold' = bullish ? 'long' : bearish ? 'short' : 'hold';

  const momentumScore = Math.abs(distancePct) / normalizedThreshold;
  const slopeScore = Math.abs(slopePct) / normalizedThreshold;
  const blendedScore = momentumScore * 0.7 + slopeScore * 0.3;
  const confidence = Math.min(0.99, blendedScore / 3);

  const availableNotional = getAvailableNotional(account);
  const { multiplier: contractMultiplier, minContracts, maxLeverage } = resolveContractSpecs(contractDetail);
  const contractSize = contractMultiplier;
  const normalizedLeverage = clampLeverageValue(params.leverage, maxLeverage);
  const normalizedContracts = ensureContractSize(baseSize, minContracts);
  const scaleFactor = Math.min(Math.max(momentumScore, 1), 5);
  const requestedContracts = shouldTrade
    ? ensureContractSize(Math.round(normalizedContracts * scaleFactor), minContracts)
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
    strategyId,
    strategy: {
      name: 'sma-trend',
      interval,
      lookback: normalizedLookback,
      threshold: normalizedThreshold,
      action,
      shouldTrade: finalShouldTrade,
      confidence,
      zScore: normalizedThreshold ? distancePct / normalizedThreshold : 0,
      totalScore: Math.round(Math.min(blendedScore * 20, 100)),
      recommendedSize: appliedContracts,
      recommendedNotional: appliedNotional,
      requestedNotional,
      appliedNotional,
      contractSize,
      leverageLimit: maxLeverage,
      appliedLeverage: normalizedLeverage ?? 1,
      autoExecuted: autoExecute,
      status: shouldTrade ? '趋势触发' : '等待信号',
    },
    market: {
      contract,
      settle,
      lastPrice,
      meanPrice,
      stdDeviation,
      valueAtRisk,
      equilibrium: meanPrice,
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

export const backtestSmaTrend = (params: {
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
  const highs: number[] = [];
  const lows: number[] = [];
  const times: number[] = [];
  bars.forEach((candle: any) => {
    const close = getCandleClose(candle);
    const high = getCandleHigh(candle);
    const low = getCandleLow(candle);
    if (close !== null) {
      closes.push(close);
      highs.push(high ?? close);
      lows.push(low ?? close);
      times.push(getCandleTime(candle));
    }
  });
  const normalizedLookback = Math.max(Number(lookback) || 55, 20);
  const normalizedThreshold = Math.max(Number(threshold) || 0.8, 0.1);
  if (closes.length < normalizedLookback + 5) {
    const equity = Number(initialCapital) || 0;
    return {
      stats: {
        totalPnL: 0,
        totalReturn: 0,
        winTrades: 0,
        lossTrades: 0,
        tradeCount: 0,
        initialCapital: equity,
        finalEquity: equity,
      },
      trades: [],
      equityCurve: [],
    };
  }

  const trades: any[] = [];
  const equityCurve: { time: number; value: number }[] = [];
  const initialEquity = Number(initialCapital) || 0;
  let equity = initialEquity;
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
    logBacktestTrade('sma-trend', tradeRecord);
    equityCurve.push({ time: exitTime, value: equity });
    openPos = null;
  };

  const resolveSignal = (index: number) => {
    const window = closes.slice(index - normalizedLookback, index);
    const prevWindowStart = index - normalizedLookback - 1;
    const prevWindow = prevWindowStart >= 0
      ? closes.slice(prevWindowStart, prevWindowStart + normalizedLookback)
      : null;
    const meanPrice = calcMean(window);
    const prevMean = prevWindow ? calcMean(prevWindow) : meanPrice;
    const price = closes[index];
    const distancePct = meanPrice ? ((price - meanPrice) / meanPrice) * 100 : 0;
    const slopePct = prevMean ? ((meanPrice - prevMean) / prevMean) * 100 : 0;
    const bullish = distancePct >= normalizedThreshold && slopePct >= 0;
    const bearish = distancePct <= -normalizedThreshold && slopePct <= 0;
    if (bullish) return 'long';
    if (bearish) return 'short';
    return 'hold';
  };

  const baseContracts = Math.max(1, Math.floor(Number(baseSize) || 1));

  for (let i = normalizedLookback; i < closes.length; i += 1) {
    const price = closes[i];
    const time = times[i];
    if (openPos && riskConfig) {
      const decision = evaluateRiskFromCandle(openPos.direction, openPos.price, { high: highs[i], low: lows[i] }, riskConfig);
      if (decision) {
        closePosition(decision.exitPrice, time);
        continue;
      }
    }
    const signal = resolveSignal(i);
    if (signal === 'hold') {
      continue;
    }
    if (!openPos) {
      openPos = { direction: signal, price, time, qty: baseContracts };
      continue;
    }
    if (openPos.direction === signal) {
      continue;
    }
    closePosition(price, time);
    openPos = { direction: signal, price, time, qty: baseContracts };
  }

  if (openPos) {
    const lastIndex = closes.length - 1;
    closePosition(closes[lastIndex], times[lastIndex]);
  }

  const wins = trades.filter((trade) => trade.pnl >= 0).length;
  const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const finalEquity = equity;
  const totalReturn = initialEquity ? (finalEquity - initialEquity) / initialEquity : 0;

  return {
    stats: {
      totalPnL,
      totalReturn,
      winTrades: wins,
      lossTrades: trades.length - wins,
      tradeCount: trades.length,
      initialCapital: initialEquity,
      finalEquity,
    },
    trades,
    equityCurve,
  };
};
