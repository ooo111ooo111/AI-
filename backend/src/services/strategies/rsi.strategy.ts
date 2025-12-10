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

const computeRsiSeries = (closes: number[], period: number) => {
  const series = new Array<number | null>(closes.length).fill(null);
  if (closes.length <= period) {
    return series;
  }
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  const calcRsi = (gain: number, loss: number) => {
    if (!loss) return 100;
    if (!gain) return 0;
    const rs = gain / loss;
    return 100 - 100 / (1 + rs);
  };

  series[period] = calcRsi(avgGain, avgLoss);

  for (let i = period + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    series[i] = calcRsi(avgGain, avgLoss);
  }
  return series;
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

const SIGNAL_EPSILON = 1e-8;

const logRsiDebug = (label: string, payload: Record<string, any>) => {
  try {
    console.log(`[RSI:${label}]`, JSON.stringify(payload));
  } catch (error) {
    console.log(`[RSI:${label}]`, payload);
  }
};

type RsiSignal = {
  longSignal: boolean;
  shortSignal: boolean;
  direction: 'long' | 'short' | 'hold';
  boundaryDiff: number;
  normalizedMomentum: number;
};

const detectRsiSignal = (
  prevRsi: number | null,
  currentRsi: number | null,
  oversold: number,
  overbought: number
): RsiSignal => {
  if (!Number.isFinite(currentRsi ?? NaN) || prevRsi === null || !Number.isFinite(prevRsi)) {
    return {
      longSignal: false,
      shortSignal: false,
      direction: 'hold' as const,
      boundaryDiff: 0,
      normalizedMomentum: 0,
    };
  }

  const crossUp = prevRsi < oversold && (currentRsi as number) >= oversold;
  const crossDown = prevRsi > overbought && (currentRsi as number) <= overbought;
  const boundaryDiff = crossUp
    ? Math.max(0, (currentRsi as number) - oversold)
    : crossDown
    ? Math.max(0, overbought - (currentRsi as number))
    : 0;
  const span = crossUp ? Math.max(oversold, 1) : crossDown ? Math.max(100 - overbought, 1) : 1;
  const normalizedMomentum = span > 0 ? boundaryDiff / span : 0;

  return {
    longSignal: crossUp,
    shortSignal: crossDown,
    direction: crossUp ? 'long' : crossDown ? 'short' : ('hold' as const),
    boundaryDiff,
    normalizedMomentum,
  };
};

const getSignedPositionSize = (positions: any, contract: string) => {
  if (!contract || !Array.isArray(positions)) {
    return 0;
  }
  const match = positions.find((pos) => {
    if (!pos || typeof pos !== 'object') return false;
    return String(pos.contract || '').toLowerCase() === contract.toLowerCase();
  });
  if (!match) return 0;
  const rawSize = Number(match.size ?? match.qty ?? match.position ?? 0);
  return Number.isFinite(rawSize) ? rawSize : 0;
};

const formatOrderSize = (size: number) => {
  if (!Number.isFinite(size)) return '0';
  const normalized = Number(size.toFixed(8));
  if (Math.abs(normalized) < SIGNAL_EPSILON) return '0';
  return normalized.toString();
};

interface RsiStrategyParams {
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

const normalizeThresholds = (raw: number) => {
  const oversold = Math.min(Math.max(raw, 5), 50);
  const overbought = 100 - oversold;
  return { oversold, overbought };
};

export const runRsiStrategy = async (params: RsiStrategyParams) => {
  const {
    strategyId = 'rsi-swing',
    settle,
    contract,
    interval,
    lookback,
    threshold,
    baseSize,
    autoExecute,
    gateSettings,
    useTestnet,
    takeProfitPct,
    stopLossPct,
    leverage,
  } = params;

  const normalizedLookback = Math.min(Math.max(Number(lookback) || 14, 5), 200);
  const { oversold, overbought } = normalizeThresholds(Number(threshold) || 30);
  const candleLimit = normalizedLookback + 5;

  const [candles, account, contractDetail, positions]: [any[], any, any, any] = await Promise.all([
    gateService.getCandlesticks(settle, contract, interval, candleLimit, { useTestnet }),
    gateService.getAccount(settle, gateSettings, { useTestnet }),
    gateService.getContractDetail(settle, contract, { useTestnet }),
    gateService.getPositions(settle, gateSettings, { useTestnet }),
  ]);

  const closes = candles
    .map((candle) => getCandleClose(candle))
    .filter((value): value is number => Number.isFinite(value));

  logRsiDebug('input', {
    contract,
    interval,
    lookback: normalizedLookback,
    requestedCandles: candleLimit,
    usableCloses: closes.length,
  });

  if (closes.length <= normalizedLookback + 2) {
    throw new Error('K线数据不足以运行 RSI 策略');
  }

  const rsiSeries = computeRsiSeries(closes, normalizedLookback);
  const rawLastRsi = rsiSeries[rsiSeries.length - 1];
  const rawPrevRsi = rsiSeries[rsiSeries.length - 2];
  const lastRsi = typeof rawLastRsi === 'number' ? rawLastRsi : NaN;
  const prevRsi = typeof rawPrevRsi === 'number' ? rawPrevRsi : null;
  if (!Number.isFinite(lastRsi)) {
    throw new Error('无法计算 RSI 指标');
  }

  const lastPrice = closes[closes.length - 1];
  const recentWindow = closes.slice(-normalizedLookback);
  const meanPrice = recentWindow.reduce((sum, value) => sum + value, 0) / recentWindow.length;
  const returns = calcReturns(closes.slice(-normalizedLookback * 2));
  const meanReturn = returns.length
    ? returns.reduce((sum, value) => sum + value, 0) / returns.length
    : 0;
  const variance = returns.length
    ? returns.reduce((acc, value) => acc + (value - meanReturn) ** 2, 0) /
        (returns.length || 1)
    : 0;
  const returnStd = Math.sqrt(Math.max(variance, 0));
  const VAR_Z = 1.6448536269;
  const valueAtRisk = meanReturn - returnStd * VAR_Z;

  const signal = detectRsiSignal(prevRsi, lastRsi, oversold, overbought);
  const signalTriggered = signal.longSignal || signal.shortSignal;
  const action: 'long' | 'short' | 'hold' = signal.direction;
  const signalStrength = signalTriggered ? signal.normalizedMomentum : 0;
  const confidence = signalTriggered ? Math.min(0.99, Math.max(signalStrength, 0.1)) : 0;

  logRsiDebug('signal', {
    contract,
    interval,
    oversold,
    overbought,
    lastRsi,
    prevRsi,
    signalTriggered,
    signal,
    lastPrice,
  });

  const availableNotional = getAvailableNotional(account);
  const { multiplier: contractMultiplier, minContracts, maxLeverage } = resolveContractSpecs(contractDetail);
  const contractSize = contractMultiplier;
  const normalizedLeverage = clampLeverageValue(leverage, maxLeverage);
  const baseContracts = ensureContractSize(baseSize, minContracts);
  const scaleMultiplier = signalTriggered ? Math.min(1 + signalStrength / 2, 2.5) : 0;
  const requestedContracts = signalTriggered
    ? ensureContractSize(Math.max(1, Math.round(baseContracts * Math.max(scaleMultiplier, 1))), minContracts)
    : 0;
  const requestedNotional = signalTriggered
    ? computeContractNotional(requestedContracts, lastPrice, contractMultiplier)
    : 0;
  const appliedContracts = signalTriggered
    ? clampContractsByBalance(requestedContracts, availableNotional, lastPrice, contractMultiplier, {
        leverage: normalizedLeverage,
      })
    : 0;
  const appliedNotional = signalTriggered
    ? computeContractNotional(appliedContracts, lastPrice, contractMultiplier)
    : 0;
  const currentPositionSize = getSignedPositionSize(positions, contract);
  const desiredPositionSize = signalTriggered && appliedContracts > 0
    ? signal.longSignal
      ? appliedContracts
      : -appliedContracts
    : currentPositionSize;
  const netOrderSize = signalTriggered
    ? Number((desiredPositionSize - currentPositionSize).toFixed(8))
    : 0;
  const finalShouldTrade = signalTriggered && appliedContracts > 0 && Math.abs(netOrderSize) > SIGNAL_EPSILON;
  const directionalSize = finalShouldTrade ? netOrderSize : 0;

  logRsiDebug('positioning', {
    contract,
    signalTriggered,
    currentPositionSize,
    desiredPositionSize,
    baseContracts,
    appliedContracts,
    netOrderSize,
    finalShouldTrade,
    scaleMultiplier,
    availableNotional,
    requestedNotional,
    appliedNotional,
  });

  const orderPayload = directionalSize
    ? {
        settle,
        contract,
        size: formatOrderSize(directionalSize),
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
    takeProfitPct,
    stopLossPct,
    strategy: {
      name: 'rsi-swing',
      interval,
      lookback: normalizedLookback,
      threshold: oversold,
      action,
      shouldTrade: finalShouldTrade,
      signalTriggered,
      confidence,
      recommendedSize: appliedContracts,
      recommendedNotional: appliedNotional,
      requestedNotional,
      appliedNotional,
      contractSize,
      leverageLimit: maxLeverage,
      appliedLeverage: normalizedLeverage ?? 1,
      autoExecuted: autoExecute,
      status: !signalTriggered
        ? '等待信号'
        : !appliedContracts
        ? '可用保证金不足，信号无法执行'
        : finalShouldTrade
        ? signal.longSignal
          ? 'RSI 多头信号'
          : 'RSI 空头信号'
        : '当前仓位已符合 RSI 信号',
      totalScore: signalTriggered ? Math.round(Math.min(signalStrength * 100, 100)) : 0,
    },
    market: {
      contract,
      settle,
      lastPrice,
      meanPrice,
      stdDeviation: returnStd,
      valueAtRisk,
      rsi: lastRsi,
      oversold,
      overbought,
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

export const backtestRsiStrategy = (params: {
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
    if (close !== null) {
      closes.push(close);
      highs.push(getCandleHigh(candle) ?? close);
      lows.push(getCandleLow(candle) ?? close);
      times.push(getCandleTime(candle));
    }
  });

  const normalizedLookback = Math.min(Math.max(Number(lookback) || 14, 5), 200);
  const { oversold, overbought } = normalizeThresholds(Number(threshold) || 30);

  if (closes.length <= normalizedLookback + 2) {
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

  const rsiSeries = computeRsiSeries(closes, normalizedLookback);
  const trades: any[] = [];
  const equityCurve: { time: number; value: number }[] = [];
  const initialEquity = Number(initialCapital) || 0;
  let equity = initialEquity;
  let openPos: { direction: 'long' | 'short'; price: number; time: number; qty: number } | null = null;
  const leverageValue = leverage && leverage > 0 ? leverage : 1;
  const riskConfig: RiskConfig | undefined = takeProfitPct || stopLossPct
    ? { takeProfitPct, stopLossPct, leverage: leverageValue }
    : undefined;
  const baseContracts = Math.max(1, Math.floor(Number(baseSize) || 1));
  const scaleContracts = (strength: number) => {
    const multiplier = Math.min(1 + Math.max(strength, 0) / 2, 2.5);
    return Math.max(1, Math.round(baseContracts * multiplier));
  };

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
    logBacktestTrade('rsi-swing', tradeRecord);
    equityCurve.push({ time: exitTime, value: equity });
    openPos = null;
  };

  for (let i = normalizedLookback; i < closes.length; i += 1) {
    const rawRsi = rsiSeries[i];
    const rawPrevRsi = rsiSeries[i - 1];
    if (!Number.isFinite(rawRsi)) continue;
    const rsi = rawRsi as number;
    const prevRsi = typeof rawPrevRsi === 'number' ? rawPrevRsi : null;
    const price = closes[i];
    const time = times[i];

    if (openPos && riskConfig) {
      const decision = evaluateRiskFromCandle(openPos.direction, openPos.price, { high: highs[i], low: lows[i] }, riskConfig);
      if (decision) {
        closePosition(decision.exitPrice, time);
        continue;
      }
    }

    const signal = detectRsiSignal(prevRsi, rsi, oversold, overbought);

    logRsiDebug('backtest-eval', {
      index: i,
      time,
      price,
      prevRsi,
      rsi,
      oversold,
      overbought,
      longSignal: signal.longSignal,
      shortSignal: signal.shortSignal,
      direction: signal.direction,
    });

    if (!signal.longSignal && !signal.shortSignal) {
      continue;
    }

    const direction = signal.longSignal ? 'long' : 'short';
    const targetQty = scaleContracts(signal.normalizedMomentum);

    logRsiDebug('backtest-signal', {
      index: i,
      time,
      rsi,
      prevRsi,
      signal,
      price,
      direction,
      targetQty,
    });

    if (!openPos) {
      openPos = { direction, price, time, qty: targetQty };
      continue;
    }

    if (openPos.direction === direction) {
      continue;
    }

    closePosition(price, time);
    openPos = { direction, price, time, qty: targetQty };
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
