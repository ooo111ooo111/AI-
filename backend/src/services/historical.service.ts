import { gateService } from './gate.service';

const intervalToSeconds = (interval: string) => {
  const match = /^([0-9]+)([mhd])$/i.exec(interval.trim());
  if (!match) return 60;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    case 'm':
    default:
      return value * 60;
  }
};

export const fetchHistoricalCandles = async (options: {
  settle: string;
  contract: string;
  interval: string;
  startTime: number;
  endTime: number;
  useTestnet?: boolean;
}) => {
  const { settle, contract, interval, startTime, endTime, useTestnet } = options;
  const limit = 200;
  const intervalSeconds = Math.max(intervalToSeconds(interval), 60);
  const candles: any[] = [];
  let from = Math.floor(startTime / 1000);
  const final = Math.floor(endTime / 1000);

  const normalizeGateTimestampSec = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  };

  const shouldRetry = (error: any) => {
    const message = (error?.message || '').toString().toLowerCase();
    return message.includes('timeout') || message.includes('超时');
  };

  while (from < final) {
    const to = Math.min(from + intervalSeconds * limit, final);
    let chunk: any[] = [];
    let attempt = 0;
    const maxRetry = 3;
    while (attempt < maxRetry) {
      attempt += 1;
      try {
        chunk = await gateService.getCandlesticks(settle, contract, interval, limit, {
          useTestnet,
          from,
          to,
        });
        break;
      } catch (error: any) {
        if (attempt >= maxRetry || !shouldRetry(error)) {
          throw new Error(error?.message || '获取历史K线失败');
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
    if (!Array.isArray(chunk) || chunk.length === 0) {
      break;
    }
    candles.push(...chunk);
    const last = chunk[chunk.length - 1];
    const lastTimestampRaw = Number(
      Array.isArray(last)
        ? last[0]
        : last?.t ?? last?.time ?? last?.timestamp ?? 0
    );
    const lastTimestamp = normalizeGateTimestampSec(lastTimestampRaw);
    if (lastTimestamp === null) {
      break;
    }
    const nextFrom = lastTimestamp + intervalSeconds;
    if (!Number.isFinite(nextFrom) || nextFrom <= from) {
      from += intervalSeconds * limit;
    } else {
      from = nextFrom;
    }
  }

  return candles;
};
