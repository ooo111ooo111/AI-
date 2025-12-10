import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as QQStrategy, QQProfile } from 'passport-qq';
import { HttpsProxyAgent } from 'https-proxy-agent';
import User, { IOAuthAccount } from '../models/User';
import dotenv from 'dotenv';

// 确保环境变量已加载
dotenv.config();

type OAuthProvider = IOAuthAccount['provider'];

interface UpsertOAuthUserParams {
  provider: OAuthProvider;
  providerId: string;
  email?: string | null;
  nickname?: string | null;
  avatar?: string | null;
  profile: any;
}

const upsertOAuthUser = async ({
  provider,
  providerId,
  email,
  nickname,
  avatar,
  profile
}: UpsertOAuthUserParams) => {
  let user = await User.findOne({
    'accounts.provider': provider,
    'accounts.providerId': providerId
  });

  const normalizedEmail = email?.toLowerCase();

  if (!user && normalizedEmail) {
    user = await User.findOne({ email: normalizedEmail });
  }

  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      nickname: nickname || `${provider.toUpperCase()} 用户`,
      avatar: avatar || undefined,
      accounts: [
        {
          provider,
          providerId,
          profile,
          connectedAt: new Date()
        }
      ],
      lastLoginAt: new Date()
    });

    return user;
  }

  const existingAccount = user.accounts.find(
    (account) => account.provider === provider && account.providerId === providerId
  );

  if (!existingAccount) {
    user.accounts.push({
      provider,
      providerId,
      profile,
      connectedAt: new Date()
    } as IOAuthAccount);
  } else {
    existingAccount.profile = profile;
  }

  if (avatar) {
    user.avatar = avatar;
  }

  if (normalizedEmail && !user.email) {
    user.email = normalizedEmail;
  }

  if (nickname && !user.nickname) {
    user.nickname = nickname;
  }

  user.lastLoginAt = new Date();
  await user.save();
  return user;
};

const googleStrategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    scope: ['profile', 'email'],
    proxy: true // 允许在代理/本地网络环境下正确处理回调
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await upsertOAuthUser({
        provider: 'google',
        providerId: profile.id,
        email: profile.emails?.[0]?.value,
        nickname: profile.displayName || 'Google 用户',
        avatar: profile.photos?.[0]?.value,
        profile: profile._json
      });

      return done(null, user);
    } catch (error) {
      return done(error as Error, undefined);
    }
  }
);

// 可选的代理配置(适用于国内网络环境)
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxyUrl) {
  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    (googleStrategy as any)._oauth2.setAgent(agent);
    console.log('🌐 Google OAuth 已启用代理:', proxyUrl);
  } catch (error) {
    console.warn('⚠️ Google OAuth 代理配置失败:', error);
  }
}

passport.use(googleStrategy);

const qqCredentialsReady =
  process.env.QQ_APP_ID && process.env.QQ_APP_KEY && process.env.QQ_CALLBACK_URL;

if (qqCredentialsReady) {
  const qqStrategy = new QQStrategy(
    {
      clientID: process.env.QQ_APP_ID!,
      clientSecret: process.env.QQ_APP_KEY!,
      callbackURL: process.env.QQ_CALLBACK_URL!,
      scope: ['get_user_info']
    },
    async (_accessToken: string, _refreshToken: string, profile: QQProfile, done) => {
      try {
        const rawProfile = profile._json || profile;
        const avatar =
          rawProfile?.figureurl_qq_2 ||
          rawProfile?.figureurl_qq_1 ||
          rawProfile?.figureurl_2 ||
          rawProfile?.figureurl_1 ||
          profile.photos?.[0]?.value;

        const user = await upsertOAuthUser({
          provider: 'qq',
          providerId: profile.id,
          nickname: profile.nickname || profile.displayName || rawProfile?.nickname || 'QQ 用户',
          avatar,
          profile: rawProfile
        });

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  );

  passport.use(qqStrategy);
} else {
  console.warn('⚠️ QQ OAuth 配置缺失，已跳过 QQ 策略初始化');
}

// Passport 序列化（可选，如果不使用 session 可以留空）
passport.serializeUser((user: any, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
