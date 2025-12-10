declare module 'passport-qq' {
  import type { Strategy as PassportStrategy } from 'passport';

  export interface QQProfile {
    provider: 'qq';
    id: string;
    displayName?: string;
    nickname?: string;
    _json?: any;
    photos?: Array<{ value: string }>;
  }

  export interface QQStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    state?: boolean;
  }

  export class Strategy extends PassportStrategy {
    constructor(
      options: QQStrategyOptions,
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: QQProfile,
        done: (error: any, user?: any) => void
      ) => void
    );
  }
}
