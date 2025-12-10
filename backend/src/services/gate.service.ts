import https from 'https';
import crypto from 'crypto';
import { URL } from 'url';
import type { IGateSettings } from '../models/User';

const LIVE_BASE_URL =
  process.env.GATE_LIVE_API_BASE_URL ||
  process.env.GATE_API_BASE_URL ||
  'https://api.gateio.ws/api/v4';
const TESTNET_BASE_URL =
  process.env.GATE_TESTNET_API_BASE_URL || 'https://api-testnet.gateapi.io/api/v4';

const normalizeBaseUrl = (url: string) => (url.endsWith('/') ? url.slice(0, -1) : url);
const NORMALIZED_LIVE_BASE = normalizeBaseUrl(LIVE_BASE_URL);
const NORMALIZED_TESTNET_BASE = normalizeBaseUrl(TESTNET_BASE_URL);
const REQUEST_TIMEOUT = Number(process.env.GATE_API_TIMEOUT_MS) || 45000;

const resolveBaseUrl = (useTestnet?: boolean) =>
  useTestnet ? NORMALIZED_TESTNET_BASE : NORMALIZED_LIVE_BASE;

const buildQueryString = (query?: Record<string, any>) => {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.append(key, String(value));
  });
  return params.toString();
};

interface GateRequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  query?: Record<string, any>;
  body?: Record<string, any> | null;
  credentials?: Pick<IGateSettings, 'apiKey' | 'apiSecret'>;
  useTestnet?: boolean;
}

const hashPayload = (bodyString: string) =>
  crypto.createHash('sha512').update(bodyString || '').digest('hex');

const signRequest = (
  method: string,
  path: string,
  queryString: string,
  bodyString: string,
  timestamp: string,
  secret: string
) => {
  const hashedBody = hashPayload(bodyString);
  const payload = `${method}\n${path}\n${queryString}\n${hashedBody}\n${timestamp}`;
  return crypto.createHmac('sha512', secret).update(payload).digest('hex');
};

const sendRequest = async <T>(options: GateRequestOptions): Promise<T> => {
  const method = options.method.toUpperCase();
  const normalizedPath = options.path.startsWith('/') ? options.path : `/${options.path}`;
  const queryString = buildQueryString(options.query);
  const bodyString = options.body ? JSON.stringify(options.body) : '';
  const baseUrl = resolveBaseUrl(options.useTestnet);
  const url = new URL(`${baseUrl}${normalizedPath}${queryString ? `?${queryString}` : ''}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (options.credentials) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    headers.KEY = options.credentials.apiKey;
    headers.Timestamp = timestamp;
    const pathWithPrefix = url.pathname;
    headers.SIGN = signRequest(
      method,
      pathWithPrefix,
      queryString,
      bodyString,
      timestamp,
      options.credentials.apiSecret
    );
  }

  return new Promise<T>((resolve, reject) => {
    const request = https.request(url, { method, headers }, (response) => {
      const chunks: Uint8Array[] = [];

      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed: any = raw;

        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            return reject(new Error('Gate API 返回格式错误'));
          }
        }

        if (response.statusCode && response.statusCode >= 400) {
          const message = parsed?.label || parsed?.message || 'Gate API 请求失败';
          return reject(new Error(message));
        }

        resolve(parsed as T);
      });
    });

    request.on('error', (error) => reject(error));
    request.setTimeout(REQUEST_TIMEOUT, () => {
      request.destroy(new Error('Gate API 请求超时'));
    });

    if (bodyString) {
      request.write(bodyString);
    }

    request.end();
  });
};

type GateRequestExtra = { useTestnet?: boolean; from?: number; to?: number };

export const gateService = {
  getContracts: async (settle: string, extra?: GateRequestExtra) => {
    const normalizedSettle = encodeURIComponent(settle || 'usdt');
    return sendRequest<any[]>({
      method: 'GET',
      path: `/futures/${normalizedSettle}/contracts`,
      useTestnet: extra?.useTestnet,
    });
  },

  getContractDetail: async (settle: string, contract: string, extra?: GateRequestExtra) => {
    const normalizedSettle = encodeURIComponent(settle || 'usdt');
    const normalizedContract = encodeURIComponent(contract);
    return sendRequest({
      method: 'GET',
      path: `/futures/${normalizedSettle}/contracts/${normalizedContract}`,
      useTestnet: extra?.useTestnet,
    });
  },

  getAccount: async (settle: string, credentials: IGateSettings, extra?: GateRequestExtra) => {
    const normalizedSettle = encodeURIComponent(settle || 'usdt');
    return sendRequest({
      method: 'GET',
      path: `/futures/${normalizedSettle}/accounts`,
      credentials,
      useTestnet: extra?.useTestnet,
    });
  },

  getPositions: async (settle: string, credentials: IGateSettings, extra?: GateRequestExtra) => {
    const normalizedSettle = encodeURIComponent(settle || 'usdt');
    return sendRequest({
      method: 'GET',
      path: `/futures/${normalizedSettle}/positions`,
      credentials,
      useTestnet: extra?.useTestnet,
    });
  },

  getCandlesticks: async (
    settle: string,
    contract: string,
    interval: string,
    limit: number,
    extra?: GateRequestExtra
  ) => {
    const normalizedSettle = encodeURIComponent(settle || 'usdt');
    const query: Record<string, any> = {
      contract,
      interval,
    };
    if (!extra?.from && !extra?.to) {
      query.limit = limit;
    } else {
      if (extra?.from) query.from = extra.from;
      if (extra?.to) query.to = extra.to;
    }
    return sendRequest<any[]>({
      method: 'GET',
      path: `/futures/${normalizedSettle}/candlesticks`,
      query,
      useTestnet: extra?.useTestnet,
    });
  },

  createOrder: async (
    settle: string,
    payload: Record<string, any>,
    credentials: IGateSettings,
    extra?: GateRequestExtra
  ) => {
    const normalizedSettle = encodeURIComponent(settle || 'usdt');
    try {
      const logPayload = {
        contract: payload?.contract,
        size: payload?.size,
        price: payload?.price,
        tif: payload?.tif,
        reduce_only: payload?.reduce_only,
        close: payload?.close,
        stp_act: payload?.stp_act,
      };
      console.log('[GateOrder] create', {
        settle,
        payload: logPayload,
        useTestnet: Boolean(extra?.useTestnet),
      });
    } catch (logError) {
      console.error('[GateOrder] log failed', logError);
    }
    return sendRequest({
      method: 'POST',
      path: `/futures/${normalizedSettle}/orders`,
      body: payload,
      credentials,
      useTestnet: extra?.useTestnet,
    });
  },

  updatePositionLeverage: async (
    settle: string,
    contract: string,
    leverage: number,
    credentials: IGateSettings,
    extra?: GateRequestExtra
  ) => {
    const normalizedSettle = encodeURIComponent(settle || 'usdt');
    const normalizedContract = encodeURIComponent(contract);
    return sendRequest({
      method: 'POST',
      path: `/futures/${normalizedSettle}/positions/${normalizedContract}/leverage`,
      body: { leverage: leverage.toString() },
      credentials,
      useTestnet: extra?.useTestnet,
    });
  },
};
