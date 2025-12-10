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

interface SaiScalperParams {
  strategyId: string;
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

interface SessionInfo {
  name: string;
  quality: 'PRIME' | 'GOOD' | 'SLOW' | 'AVOID';
}

const sensitivityThresholds: Record<string, { entry: number; exit: number }> = {
  High: { entry: 4, exit: 2 },
  Medium: { entry: 6, exit: 4 },
  Low: { entry: 8, exit: 6 },
};

const stabilityConfirmBars: Record<string, number> = {
  Reactive: 1,
  Normal: 3,
  Stable: 5,
  'Very Stable': 8,
};

const stabilitySmoothing: Record<string, number> = {
  Reactive: 2,
  Normal: 4,
  Stable: 6,
  'Very Stable': 10,
};

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
        // Gate futures candlesticks: [time, open, high, low, close, volume]
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

const computeSMA = (values: number[], period: number) => {
  const result = new Array<number>(values.length).fill(NaN);
  if (period <= 1) {
    return values.slice();
  }
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    const window = Math.min(i + 1, period);
    result[i] = sum / window;
  }
  return result;
};

const computeRMA = (values: number[], period: number) => {
  const result = new Array<number>(values.length).fill(NaN);
  let prev = values[0];
  result[0] = prev;
  for (let i = 1; i < values.length; i += 1) {
    prev = prev + (values[i] - prev) / period;
    result[i] = prev;
  }
  return result;
};

const computeATR = (highs: number[], lows: number[], closes: number[], period: number) => {
  const result = new Array<number>(highs.length).fill(NaN);
  let prevATR = highs[0] - lows[0];
  result[0] = prevATR;
  for (let i = 1; i < highs.length; i += 1) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    prevATR = ((prevATR * (period - 1)) + tr) / period;
    result[i] = prevATR;
  }
  return result;
};

const computeSTD = (values: number[], period: number) => {
  const result = new Array<number>(values.length).fill(NaN);
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - period + 1);
    const windowValues = values.slice(start, i + 1);
    if (!windowValues.length) {
      result[i] = NaN;
      continue;
    }
    const mean = windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length;
    const variance =
      windowValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / windowValues.length;
    result[i] = Math.sqrt(Math.max(variance, 0));
  }
  return result;
};

const rollingMax = (values: number[], period: number) => {
  const result = new Array<number>(values.length).fill(NaN);
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - period + 1);
    let max = -Infinity;
    for (let j = start; j <= i; j += 1) {
      max = Math.max(max, values[j]);
    }
    result[i] = max;
  }
  return result;
};

const rollingMin = (values: number[], period: number) => {
  const result = new Array<number>(values.length).fill(NaN);
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - period + 1);
    let min = Infinity;
    for (let j = start; j <= i; j += 1) {
      min = Math.min(min, values[j]);
    }
    result[i] = min;
  }
  return result;
};

const computeRSI = (values: number[], period: number) => {
  const result = new Array<number>(values.length).fill(NaN);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    if (i < period) {
      avgGain += gain;
      avgLoss += loss;
      result[i] = NaN;
      continue;
    }
    if (i === period) {
      avgGain /= period;
      avgLoss /= period;
    } else {
      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    }
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs);
  }
  return result;
};

const calcSessionInfo = (timestamp: number): SessionInfo => {
  const date = new Date(timestamp);
  const utcHour = date.getUTCHours();
  const isSydney = utcHour >= 21 || utcHour < 6;
  const isTokyo = utcHour >= 0 && utcHour < 9;
  const isLondon = utcHour >= 8 && utcHour < 17;
  const isNewYork = utcHour >= 13 && utcHour < 22;
  const isTokyoLondon = utcHour >= 8 && utcHour < 9;
  const isLondonNy = utcHour >= 13 && utcHour < 17;

  if (isLondonNy) {
    return { name: 'LDN/NY 🔥', quality: 'PRIME' };
  }
  if (isTokyoLondon) {
    return { name: 'TKY/LDN', quality: 'GOOD' };
  }
  if (isLondon || isNewYork) {
    return { name: isLondon ? 'LONDON' : 'NEW YORK', quality: 'GOOD' };
  }
  if (isSydney || isTokyo) {
    return { name: isSydney ? 'SYDNEY' : 'TOKYO', quality: 'SLOW' };
  }
  return { name: 'CLOSED', quality: 'AVOID' };
};

const calculateSaiScalperState = (bars: CandleBar[], thresholdOverride?: number) => {
  const ATRPeriod = 200;
  const ATRFactor = 8;
  const adxLength = 14;
  const adxThreshold = 20;
  const volLength = 20;
  const atrCompressLen = 20;
  const rangeLength = 20;
  const scalpSensitivity = 'Medium';
  const signalStability = 'Normal';
  const riskReward = 2;
  const trailTypeModified = true;

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const closes = bars.map((b) => b.close);
  const opens = bars.map((b) => b.open);
  const volumes = bars.map((b) => b.volume || 0);
  const len = bars.length;

  const rangeSeries = highs.map((high, idx) => high - lows[idx]);
  const rangeSMA = computeSMA(rangeSeries, ATRPeriod);

  const trueRangeCustom = new Array<number>(len).fill(0);
  const wildMa = new Array<number>(len).fill(0);
  const lossArr = new Array<number>(len).fill(0);
  const trendUpArr = new Array<number>(len).fill(0);
  const trendDownArr = new Array<number>(len).fill(0);
  const trendArr = new Array<number>(len).fill(1);
  const trailArr = new Array<number>(len).fill(0);
  const exArr = new Array<number>(len).fill(0);
  const eqArr = new Array<number>(len).fill(0);
  const f2Arr = new Array<number>(len).fill(0);

  for (let i = 0; i < len; i += 1) {
    const range = rangeSeries[i];
    const smaRange = Number.isFinite(rangeSMA[i]) ? rangeSMA[i] : range;
    const hiLo = Math.min(range, 1.5 * smaRange);
    const prevHigh = i > 0 ? highs[i - 1] : highs[i];
    const prevLow = i > 0 ? lows[i - 1] : lows[i];
    const prevClose = i > 0 ? closes[i - 1] : closes[i];
    const normCPrev = i > 0 ? closes[i - 1] : closes[i];
    const hRef = lows[i] <= prevHigh
      ? highs[i] - normCPrev
      : highs[i] - normCPrev - 0.5 * (lows[i] - prevHigh);
    const lRef = highs[i] >= prevLow
      ? normCPrev - lows[i]
      : normCPrev - lows[i] - 0.5 * (prevLow - highs[i]);
    const trueRangeVal = trailTypeModified
      ? Math.max(hiLo, hRef, lRef)
      : Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - prevClose),
          Math.abs(lows[i] - prevClose)
        );
    trueRangeCustom[i] = trueRangeVal;
    if (i === 0) {
      wildMa[i] = trueRangeVal;
    } else {
      wildMa[i] = wildMa[i - 1] + (trueRangeVal - wildMa[i - 1]) / ATRPeriod;
    }
    const loss = ATRFactor * wildMa[i];
    lossArr[i] = loss;
    const up = closes[i] - loss;
    const down = closes[i] + loss;

    if (i === 0) {
      trendUpArr[i] = up;
      trendDownArr[i] = down;
      trailArr[i] = up;
      exArr[i] = highs[i];
      eqArr[i] = (exArr[i] + trailArr[i]) / 2;
      f2Arr[i] = exArr[i] + (trailArr[i] - exArr[i]) * 0.786;
      continue;
    }

    trendUpArr[i] = closes[i - 1] > trendUpArr[i - 1] ? Math.max(up, trendUpArr[i - 1]) : up;
    trendDownArr[i] = closes[i - 1] < trendDownArr[i - 1] ? Math.min(down, trendDownArr[i - 1]) : down;

    const prevTrend = trendArr[i - 1];
    let currentTrend = prevTrend;
    if (closes[i] > trendDownArr[i - 1]) {
      currentTrend = 1;
    } else if (closes[i] < trendUpArr[i - 1]) {
      currentTrend = -1;
    }
    trendArr[i] = currentTrend;
    trailArr[i] = currentTrend === 1 ? trendUpArr[i] : trendDownArr[i];

    const crossUp = prevTrend !== 1 && currentTrend === 1;
    const crossDown = prevTrend !== -1 && currentTrend === -1;
    if (crossUp) {
      exArr[i] = highs[i];
    } else if (crossDown) {
      exArr[i] = lows[i];
    } else if (currentTrend === 1) {
      exArr[i] = Math.max(exArr[i - 1], highs[i]);
    } else {
      exArr[i] = Math.min(exArr[i - 1], lows[i]);
    }
    eqArr[i] = exArr[i] + (trailArr[i] - exArr[i]) * 0.5;
    f2Arr[i] = exArr[i] + (trailArr[i] - exArr[i]) * 0.786;
  }

  const atrCompress = computeATR(highs, lows, closes, atrCompressLen);
  const atrAvg = computeSMA(atrCompress, atrCompressLen * 2);
  const atr14 = computeATR(highs, lows, closes, 14);

  const dirmov = (lenParam: number) => {
    const plus = new Array<number>(len).fill(0);
    const minus = new Array<number>(len).fill(0);
    let prevTR = 0;
    for (let i = 1; i < len; i += 1) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
      const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      prevTR = prevTR === 0 ? tr : prevTR + (tr - prevTR) / lenParam;
      plus[i] = plus[i - 1] + (plusDM - plus[i - 1]) / lenParam;
      minus[i] = minus[i - 1] + (minusDM - minus[i - 1]) / lenParam;
    }
    return { plus, minus, tr: prevTR };
  };

  const adxCalc = (length: number) => {
    const di = dirmov(length);
    const result = new Array<number>(len).fill(0);
    let prevADX = 0;
    for (let i = 1; i < len; i += 1) {
      const sum = di.plus[i] + di.minus[i];
      const dx = sum === 0 ? 0 : (Math.abs(di.plus[i] - di.minus[i]) / sum) * 100;
      prevADX = ((prevADX * (length - 1)) + dx) / length;
      result[i] = prevADX;
    }
    return result;
  };

  const adxSeries = adxCalc(adxLength);
  const volAvg = computeSMA(volumes, volLength);
  const rangeAvg = computeSMA(rangeSeries, rangeLength);
  const highestRecent = rollingMax(highs, rangeLength);
  const lowestRecent = rollingMin(lows, rangeLength);
  const consolidationRange = highestRecent.map((value, idx) => value - lowestRecent[idx]);
  const consolidationAvg = computeSMA(consolidationRange, rangeLength);
  const rsiSeries = computeRSI(closes, 14);
  const bbBasis = computeSMA(closes, 20);
  const bbStd = computeSTD(closes, 20);
  const bbWidth = bbBasis.map((basis, idx) => {
    const dev = (bbStd[idx] || 0) * 2;
    if (!Number.isFinite(basis) || basis === 0) return 0;
    return (dev / basis) * 100;
  });
  const bbAvgWidth = computeSMA(bbWidth, 50);

  const rawScores = new Array<number>(len).fill(0);
  for (let i = 0; i < len; i += 1) {
    const atrRatio = atrAvg[i] ? atrCompress[i] / atrAvg[i] : 1;
    const atrScore = atrRatio < 0.6 ? 2 : atrRatio < 0.8 ? 1 : 0;
    const adxValue = adxSeries[i] || 0;
    const adxScore = adxValue < 15 ? 2 : adxValue < adxThreshold ? 1 : 0;
    const volRatio = volAvg[i] ? volumes[i] / volAvg[i] : 1;
    const volScore = volRatio < 0.5 ? 2 : volRatio < 0.7 ? 1 : 0;
    const rangeRatio = rangeAvg[i] ? rangeSeries[i] / rangeAvg[i] : 1;
    const rangeScore = rangeRatio < 0.4 ? 2 : rangeRatio < 0.6 ? 1 : 0;
    const consAvg = consolidationAvg[i] || 0;
    const consScore = consAvg && consolidationRange[i] < consAvg * 0.5
      ? 2
      : consAvg && consolidationRange[i] < consAvg * 0.7
      ? 1
      : 0;
    const rsiVal = rsiSeries[i] || 0;
    const rsiScore = rsiVal > 45 && rsiVal < 55 ? 2 : rsiVal > 40 && rsiVal < 60 ? 1 : 0;
    const widthRatio = bbAvgWidth[i] ? bbWidth[i] / bbAvgWidth[i] : 1;
    const bbScore = widthRatio < 0.6 ? 2 : widthRatio < 0.8 ? 1 : 0;
    rawScores[i] = Math.min(10, atrScore + adxScore + volScore + rangeScore + consScore + rsiScore + bbScore);
  }

  const smoothingPeriod = stabilitySmoothing[signalStability] || 4;
  const totalScore = new Array<number>(len).fill(0);
  let prevSmoothed = rawScores[0];
  totalScore[0] = rawScores[0];
  for (let i = 1; i < len; i += 1) {
    const value = rawScores[i];
    prevSmoothed = prevSmoothed + (value - prevSmoothed) * (2 / (smoothingPeriod + 1));
    totalScore[i] = Math.round(prevSmoothed);
  }

  const thresholds = sensitivityThresholds[scalpSensitivity] || sensitivityThresholds.Medium;
  let entryThreshold = thresholds.entry;
  if (thresholdOverride && Number.isFinite(thresholdOverride) && thresholdOverride > 0) {
    entryThreshold = thresholdOverride;
  }
  const exitThreshold = Math.max(entryThreshold - 2, 1);
  const primeEntryThreshold = Math.max(entryThreshold + 2, entryThreshold);
  const primeExitThreshold = Math.max(primeEntryThreshold - 2, 2);
  const confirmBars = stabilityConfirmBars[signalStability] || 3;

  const scalpingFlags = new Array<boolean>(len).fill(false);
  const primeFlags = new Array<boolean>(len).fill(false);
  const statusTexts = new Array<string>(len).fill('WAIT');

  let isScalping = false;
  let isPrime = false;
  let barsAboveEntry = 0;
  let barsBelowExit = 0;
  let barsAbovePrime = 0;
  let barsBelowPrimeExit = 0;

  for (let i = 0; i < len; i += 1) {
    const score = totalScore[i];
    barsAboveEntry = score >= entryThreshold ? barsAboveEntry + 1 : 0;
    if (barsAboveEntry >= confirmBars) {
      isScalping = true;
    }
    barsBelowExit = score < exitThreshold ? barsBelowExit + 1 : 0;
    if (barsBelowExit >= confirmBars) {
      isScalping = false;
    }
    barsAbovePrime = score >= primeEntryThreshold ? barsAbovePrime + 1 : 0;
    if (barsAbovePrime >= confirmBars) {
      isPrime = true;
    }
    barsBelowPrimeExit = score < primeExitThreshold ? barsBelowPrimeExit + 1 : 0;
    if (barsBelowPrimeExit >= confirmBars) {
      isPrime = false;
    }
    scalpingFlags[i] = isScalping;
    primeFlags[i] = isPrime;

    const pendingEntry = !isScalping && barsAboveEntry > 0 && barsAboveEntry < confirmBars;
    const pendingExit = isScalping && barsBelowExit > 0 && barsBelowExit < confirmBars;
    const statusText = isPrime
      ? 'PRIME SCALP'
      : isScalping
      ? pendingExit
        ? 'ENDING'
        : 'SCALP READY'
      : pendingEntry
      ? 'CONFIRMING'
      : 'WAIT';
    statusTexts[i] = statusText;
  }

  const idx = len - 1;
  const state = trendArr[idx] === 1 ? 'long' : 'short';
  const optimalEntry = state === 'long' ? closes[idx] <= f2Arr[idx] : closes[idx] >= f2Arr[idx];
  const rsiVal = rsiSeries[idx] || 0;
  const rsiNeutral = rsiVal > 40 && rsiVal < 60;
  let entryQuality = optimalEntry ? 80 : 50;
  entryQuality += scalpingFlags[idx] ? 15 : 0;
  entryQuality += rsiNeutral ? 5 : 0;
  entryQuality = Math.min(100, entryQuality);

  const sessionInfo = calcSessionInfo(bars[idx].time);

  const emaFastSeries = computeRMA(closes, 9);
  const emaSlowSeries = computeRMA(closes, 21);

  return {
    state: state as 'long' | 'short',
    isScalping: scalpingFlags[idx],
    isPrime: primeFlags[idx],
    optimalEntry,
    totalScore: totalScore[idx],
    entryThreshold,
    statusText: statusTexts[idx],
    entryQuality,
    session: sessionInfo,
    atr14: atr14[idx],
    trail: trailArr[idx],
    eq: eqArr[idx],
    fibEntry: f2Arr[idx],
    close: closes[idx],
    scoreComponents: {
      atrRatio: atrAvg[idx] ? atrCompress[idx] / atrAvg[idx] : 1,
      adx: adxSeries[idx],
    },
    rsiNeutral,
    emaTrend: emaFastSeries[idx] > emaSlowSeries[idx] ? 1 : -1,
    candle: bars[idx],
  };
};

export const runSaiScalperStrategy = async (params: SaiScalperParams) => {
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

  const candleLimit = Math.max(lookback, 400);
  const [candles, account, contractDetail]: [any[], any, any] = await Promise.all([
    gateService.getCandlesticks(settle, contract, interval, candleLimit, { useTestnet }),
    gateService.getAccount(settle, gateSettings, { useTestnet }),
    gateService.getContractDetail(settle, contract, { useTestnet }),
  ]);

  const availableNotional = getAvailableNotional(account);
  const { multiplier: contractMultiplier, minContracts, maxLeverage } = resolveContractSpecs(contractDetail);
  const contractSize = contractMultiplier;
  const normalizedLeverage = clampLeverageValue(params.leverage, maxLeverage);

  const bars = normalizeCandles(candles);
  if (bars.length < 100) {
    throw new Error('K线数据不足以运行 Sai Scalper 策略');
  }

  const state = calculateSaiScalperState(bars, threshold);
  const totalScoreValue = Number.isFinite(state.totalScore) ? state.totalScore : 0;
  const shouldTrade =
    state.isScalping &&
    state.optimalEntry &&
    totalScoreValue >= state.entryThreshold &&
    state.session.quality !== 'AVOID';
  const direction = state.state;
  const sizeMultiplier = state.isPrime ? 2 : 1;
  const normalizedBaseContracts = ensureContractSize(baseSize, minContracts);
  const markPrice = Math.max(state.close || bars[bars.length - 1]?.close || 0, 1e-6);
  const requestedContracts = shouldTrade
    ? ensureContractSize(normalizedBaseContracts * sizeMultiplier, minContracts)
    : 0;
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
      name: 'sai-scalper-pro',
      interval,
      lookback,
      threshold,
      action: finalShouldTrade ? direction : 'hold',
      totalScore: totalScoreValue,
      status: state.statusText,
      isScalping: state.isScalping,
      isPrime: state.isPrime,
      optimalEntry: state.optimalEntry,
      entryQuality: state.entryQuality,
      session: state.session,
      shouldTrade: finalShouldTrade,
      confidence: Math.min(0.99, totalScoreValue / 10),
      zScore: totalScoreValue,
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
      lastPrice: state.close,
      trail: state.trail,
      fibEntry: state.fibEntry,
      equilibrium: state.eq,
      meanPrice: state.eq,
      stdDeviation: state.scoreComponents.atrRatio,
      valueAtRisk: totalScoreValue,
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
      session: state.session,
      entryQuality: state.entryQuality,
      score: totalScoreValue,
      rsiNeutral: state.rsiNeutral,
      emaTrend: state.emaTrend,
      threshold,
    },
  };
};

export const backtestSaiScalper = (params: {
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
    bars: rawBars,
    lookback,
    threshold,
    baseSize,
    initialCapital,
    takeProfitPct,
    stopLossPct,
    leverage,
    contractSize,
  } = params;
  const bars = normalizeCandles(rawBars);
  const trades: any[] = [];
  const initialEquity = Number(initialCapital) || 0;
  let openPos: { direction: 'long' | 'short'; price: number; time: number; qty: number } | null = null;
  let equity = initialEquity;
  const equityCurve: { time: number; value: number }[] = [];
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
    logBacktestTrade('sai-scalper', tradeRecord);
    equityCurve.push({ time: exitTime, value: equity });
    openPos = null;
  };

  for (let i = lookback; i < bars.length; i += 1) {
    const slice = bars.slice(0, i + 1);
    const state = calculateSaiScalperState(slice, threshold);
    const totalScore = Number.isFinite(state.totalScore) ? state.totalScore : 0;
    if (openPos && riskConfig) {
      const decision = evaluateRiskFromCandle(openPos.direction, openPos.price, bars[i], riskConfig);
      if (decision) {
        closePosition(decision.exitPrice, bars[i].time);
        continue;
      }
    }
    const shouldTrade =
      state.isScalping &&
      state.optimalEntry &&
      totalScore >= state.entryThreshold &&
      state.session.quality !== 'AVOID';
    if (!shouldTrade) continue;
    const direction = state.state;
    const price = state.close;
    if (!openPos) {
      const baseContracts = Math.max(Math.floor(Number(baseSize) || 1), 1);
      const scaledContracts = Math.max(1, Math.floor(baseContracts * (state.isPrime ? 2 : 1)));
      openPos = { direction, price, time: bars[i].time, qty: scaledContracts };
    } else if (openPos.direction !== direction) {
      closePosition(price, bars[i].time);
      const baseContracts = Math.max(Math.floor(Number(baseSize) || 1), 1);
      const scaledContracts = Math.max(1, Math.floor(baseContracts * (state.isPrime ? 2 : 1)));
      openPos = { direction, price, time: bars[i].time, qty: scaledContracts };
    }
  }

  const wins = trades.filter((t) => t.pnl >= 0).length;
  const losses = trades.length - wins;
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalReturn = initialEquity ? (equity - initialEquity) / initialEquity : 0;
  return {
    stats: {
      totalPnL,
      totalReturn,
      winTrades: wins,
      lossTrades: losses,
      tradeCount: trades.length,
      initialCapital: initialEquity,
      finalEquity: equity,
    },
    trades,
    equityCurve,
  };
};
