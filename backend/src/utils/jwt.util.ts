import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';
const ACCESS_EXPIRE = process.env.JWT_ACCESS_EXPIRE || '2h';

export interface JWTPayload {
  userId: string;
  email?: string;
  provider: 'qq' | 'google';
}

// 生成 access token
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRE } as jwt.SignOptions);
};

// 验证 token
export const verifyAccessToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
};
