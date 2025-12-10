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

interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const toNumber = (value: any, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeTimestamp = (value: any) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return Date.now();
  }
  return num > 1e12 ? num : num * 1000;
};

const normalizeCandles = (candles: any[]): CandleBar[] => {
  const bars = candles
    .map((item) => {
      if (Array.isArray(item)) {
        const [time, open, high, low, close, volume] = item;
        return {
          time: normalizeTimestamp(time),
          open: toNumber(open),
          high: toNumber(high),
          low: toNumber(low),
          close: toNumber(close),
          volume: toNumber(volume),
        };
      }
      if (typeof item === 'object' && item) {
        return {
          time: normalizeTimestamp(item.t ?? item.time),
          open: toNumber(item.o ?? item.open),
          high: toNumber(item.h ?? item.high),
          low: toNumber(item.l ?? item.low),
          close: toNumber(item.c ?? item.close),
          volume: toNumber(item.v ?? item.volume),
        };
      }
      return null;
    })
    .filter((bar): bar is CandleBar => {
      if (!bar) return false;
      return bar.high >= bar.low;
    });

  return bars.sort((a, b) => a.time - b.time);
};

const computeATR = (bars: CandleBar[], period: number) => {
  const result = new Array<number>(bars.length).fill(0);
  if (bars.length === 0) {
    return result;
  }
  let prevClose = bars[0].close;
  let prevATR = bars[0].high - bars[0].low;
  result[0] = prevATR;
  for (let i = 1; i < bars.length; i += 1) {
    const high = bars[i].high;
    const low = bars[i].low;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    prevATR = ((prevATR * (period - 1)) + tr) / period;
    result[i] = prevATR;
    prevClose = bars[i].close;
  }
  return result;
};

const buildHeikinAshiClose = (bars: CandleBar[]) => {
  if (!bars.length) return [];
  const closes = new Array<number>(bars.length).fill(0);
  let prevHaOpen = (bars[0].open + bars[0].close) / 2;
  let prevHaClose = (bars[0].open + bars[0].high + bars[0].low + bars[0].close) / 4;
  closes[0] = prevHaClose;
  for (let i = 1; i < bars.length; i += 1) {
    const haClose = (bars[i].open + bars[i].high + bars[i].low + bars[i].close) / 4;
    const haOpen = (prevHaOpen + prevHaClose) / 2;
    prevHaOpen = haOpen;
    prevHaClose = haClose;
    closes[i] = haClose;
  }
  return closes;
};

interface UtBotState {
  trailingStop: number[];
  positions: number[];
  buySignals: boolean[];
  sellSignals: boolean[];
  source: number[];
  atrSeries: number[];
}

const calculateUtBotState = (
  bars: CandleBar[],
  keyValue: number,
  atrPeriod: number,
  useHeikinAshi: boolean
): UtBotState => {
  const len = bars.length;
  const trailingStop = new Array<number>(len).fill(0);
  const positions = new Array<number>(len).fill(0);
  const buySignals = new Array<boolean>(len).fill(false);
  const sellSignals = new Array<boolean>(len).fill(false);
  const source = useHeikinAshi ? buildHeikinAshiClose(bars) : bars.map((bar) => bar.close);
  const atrSeries = computeATR(bars, Math.max(atrPeriod, 1));

  for (let i = 0; i < len; i += 1) {
    const prevStop = i > 0 ? trailingStop[i - 1] : source[i];
    const prevSrc = i > 0 ? source[i - 1] : source[i];
    const loss = keyValue * (atrSeries[i] || atrSeries[Math.max(i - 1, 0)] || 0);
    let stop = prevStop;

    if (source[i] > prevStop && prevSrc > prevStop) {
      stop = Math.max(prevStop, source[i] - loss);
    } else if (source[i] < prevStop && prevSrc < prevStop) {
      stop = Math.min(prevStop, source[i] + loss);
    } else if (source[i] > prevStop) {
      stop = source[i] - loss;
    } else {
      stop = source[i] + loss;
    }
    trailingStop[i] = stop;

    let currentPos = i > 0 ? positions[i - 1] : 0;
    const crossedAbove = prevSrc <= prevStop && source[i] > stop;
    const crossedBelow = prevSrc >= prevStop && source[i] < stop;

    if (crossedAbove) {
      currentPos = 1;
      buySignals[i] = true;
    } else if (crossedBelow) {
      currentPos = -1;
      sellSignals[i] = true;
    }
    positions[i] = currentPos;
  }

  return {
    trailingStop,
    positions,
    buySignals,
    sellSignals,
    source,
    atrSeries,
  };
};

interface UtBotParams {
  strategyId: string;
  settle: string;
  contract: string;
  interval: string;
  lookback: number;
  threshold: number;
  baseSize: number;
  autoExecute: boolean;
  gateSettings: IGateSettings;
  useHeikinAshi?: boolean;
  useTestnet?: boolean;
  leverage?: number;
}

export const runUtBotStrategy = async (params: UtBotParams) => {
  const {
    settle,
    contract,
    interval,
    lookback,
    threshold,
    baseSize,
    autoExecute,
    gateSettings,
    useHeikinAshi,
    useTestnet,
    leverage,
  } = params;

  const candleLimit = Math.max(lookback, 300);
  const [candles, account, contractDetail]: [any[], any, any] = await Promise.all([
    gateService.getCandlesticks(settle, contract, interval, candleLimit, { useTestnet }),
    gateService.getAccount(settle, gateSettings, { useTestnet }),
    gateService.getContractDetail(settle, contract, { useTestnet }),
  ]);

  const bars = normalizeCandles(candles);
  if (bars.length < Math.max(lookback, 20)) {
    throw new Error('K线数据不足以运行 UT Bot 策略');
  }

  const keyValue = Math.max(threshold || 1, 0.5);
  const atrPeriod = Math.max(lookback || 10, 1);

  const state = calculateUtBotState(bars, keyValue, atrPeriod, Boolean(useHeikinAshi));
  const idx = state.source.length - 1;
  const buy = state.buySignals[idx];
  const sell = state.sellSignals[idx];
  const lastPos = state.positions[idx];
  const direction = buy ? 'long' : sell ? 'short' : lastPos >= 0 ? 'long' : 'short';
  const shouldTrade = buy || sell;

  const trail = state.trailingStop[idx];
  const src = state.source[idx];
  const atrValue = state.atrSeries[idx] || state.atrSeries[Math.max(idx - 1, 0)] || 1;
  const score = Math.abs(src - trail) / Math.max(keyValue * atrValue, 1e-6);
  const entryQuality = Math.round(Math.min(100, Math.max(30, score * 100)));

  const availableNotional = getAvailableNotional(account);
  const { multiplier: contractMultiplier, minContracts, maxLeverage } = resolveContractSpecs(contractDetail);
  const contractSize = contractMultiplier;
  const normalizedLeverage = clampLeverageValue(leverage, maxLeverage);
  const normalizedContracts = ensureContractSize(baseSize, minContracts);
  const markPrice = Math.max(src || bars[bars.length - 1]?.close || 0, 1e-6);
  const requestedContracts = shouldTrade ? normalizedContracts : 0;
  const requestedNotional = computeContractNotional(requestedContracts, markPrice, contractMultiplier);
  const appliedContracts = clampContractsByBalance(
    requestedContracts,
    availableNotional,
    markPrice,
    contractMultiplier,
    { leverage: normalizedLeverage }
  );
  const appliedNotional = computeContractNotional(appliedContracts, markPrice, contractMultiplier);
  const finalShouldTrade = shouldTrade && appliedContracts > 0;
  const directionalSize = finalShouldTrade
    ? direction === 'long'
      ? appliedContracts
      : -appliedContracts
    : 0;
  const orderPayload = finalShouldTrade
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
      name: 'ut-bot-alerts',
      interval,
      lookback: atrPeriod,
      threshold: keyValue,
      action: finalShouldTrade ? direction : 'hold',
      totalScore: score,
      status: buy ? 'UT Bot 多头信号' : sell ? 'UT Bot 空头信号' : '等待信号',
      isScalping: false,
      isPrime: shouldTrade,
      optimalEntry: shouldTrade,
      entryQuality,
      session: {
        name: 'UT Bot',
        quality: shouldTrade ? 'GOOD' : 'SLOW',
      },
      shouldTrade: finalShouldTrade,
      confidence: Math.min(0.99, score / 3),
      zScore: score,
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
      lastPrice: src,
      trail,
      fibEntry: trail,
      equilibrium: trail,
      meanPrice: trail,
      stdDeviation: atrValue,
      valueAtRisk: score,
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
    diagnostics: {
      threshold: keyValue,
      atrPeriod,
      useHeikinAshi: Boolean(useHeikinAshi),
      trailingStop: trail,
      score,
    },
  };
};

export const backtestUtBot = (params: {
  bars: any[];
  threshold: number;
  lookback: number;
  baseSize: number;
  useHeikinAshi?: boolean;
  initialCapital: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
  contractSize?: number;
}) => {
  const {
    bars: rawBars,
    threshold,
    lookback,
    baseSize,
    useHeikinAshi,
    initialCapital,
    takeProfitPct,
    stopLossPct,
    leverage,
    contractSize,
  } = params;
  const bars = normalizeCandles(rawBars);
  if (!bars.length) {
    const initialEquity = Number(initialCapital) || 0;
    return {
      stats: {
        totalPnL: 0,
        totalReturn: 0,
        winTrades: 0,
        lossTrades: 0,
        tradeCount: 0,
        initialCapital: initialEquity,
        finalEquity: initialEquity,
      },
      trades: [],
      equityCurve: [],
    };
  }
  const state = calculateUtBotState(bars, Math.max(threshold || 1, 0.5), Math.max(lookback || 10, 1), Boolean(useHeikinAshi));
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
    logBacktestTrade('ut-bot', tradeRecord);
    equityCurve.push({ time: exitTime, value: equity });
    openPos = null;
  };

  for (let i = 1; i < bars.length; i += 1) {
    const buy = state.buySignals[i];
    const sell = state.sellSignals[i];
    const price = state.source[i];
    const time = bars[i].time;
    if (openPos && riskConfig) {
      const decision = evaluateRiskFromCandle(openPos.direction, openPos.price, bars[i], riskConfig);
      if (decision) {
        closePosition(decision.exitPrice, time);
        continue;
      }
    }
    if (!buy && !sell) continue;
    const direction = buy ? 'long' : 'short';
    if (!openPos) {
      const baseContracts = Math.max(Math.floor(Number(baseSize) || 1), 1);
      openPos = { direction, price, time, qty: baseContracts };
      continue;
    }
    if (openPos.direction !== direction) {
      closePosition(price, time);
      const baseContracts = Math.max(Math.floor(Number(baseSize) || 1), 1);
      openPos = { direction, price, time, qty: baseContracts };
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
