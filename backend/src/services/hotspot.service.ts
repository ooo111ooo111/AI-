import axios from 'axios';
import HotTweet from '../models/HotTweet';

const X_API_BASE = 'https://api.x.com/2';
const hotspotEnabled = process.env.ENABLE_HOTSPOT === 'true';
const bearerToken = hotspotEnabled ? process.env.X_API_BEARER_TOKEN : undefined;
const handles = (process.env.X_HOT_ACCOUNTS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const keywordList = (process.env.X_HOT_KEYWORDS || 'btc,bitcoin,crypto,eth,ethereum,sol,solana,币圈,加密,web3')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const fetchInterval = Number(process.env.X_HOT_FETCH_INTERVAL_MS || 90000);
const retentionDays = Number(process.env.X_HOT_RETENTION_DAYS || 7);

const userCache = new Map<string, { id: string; name: string; username: string; profile_image_url: string }>();
let pollingTimer: NodeJS.Timeout | null = null;

const axiosInstance = axios.create({
  baseURL: X_API_BASE,
  headers: bearerToken
    ? {
        Authorization: `Bearer ${bearerToken}`,
      }
    : undefined,
});

const matchesKeywords = (text: string) => {
  if (!keywordList.length) return true;
  const lower = (text || '').toLowerCase();
  return keywordList.some((keyword) => lower.includes(keyword));
};

async function fetchUser(handle: string) {
  if (userCache.has(handle)) {
    return userCache.get(handle)!;
  }
  const response = await axiosInstance.get(`/users/by/username/${handle}`, {
    params: {
      'user.fields': 'profile_image_url,name,username',
    },
  });
  const user = response.data?.data;
  if (!user) {
    return null;
  }
  userCache.set(handle, user);
  return user;
}

async function fetchTweetsForUser(userId: string) {
  const response = await axiosInstance.get(`/users/${userId}/tweets`, {
    params: {
      max_results: 5,
      'tweet.fields': 'created_at,public_metrics,entities',
      expansions: 'author_id',
    },
  });
  return response.data?.data || [];
}

async function saveTweet(tweet: any, user: any) {
  if (!tweet?.id || !user) return;
  if (!matchesKeywords(tweet.text || '')) {
    return;
  }

  const metrics = tweet.public_metrics || {};
  const keywordsHit = keywordList.filter((keyword) => (tweet.text || '').toLowerCase().includes(keyword));

  await HotTweet.findOneAndUpdate(
    { tweetId: tweet.id },
    {
      tweetId: tweet.id,
      authorId: user.id,
      authorName: user.name,
      authorHandle: user.username,
      authorAvatar: user.profile_image_url,
      text: tweet.text,
      postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
      likeCount: metrics.like_count || 0,
      retweetCount: metrics.retweet_count || 0,
      replyCount: metrics.reply_count || 0,
      quoteCount: metrics.quote_count || 0,
      url: `https://x.com/${user.username}/status/${tweet.id}`,
      keywords: keywordsHit,
    },
    { upsert: true, new: true }
  );
}

export async function syncHotTweets() {
  if (!hotspotEnabled || !bearerToken || !handles.length) {
    return;
  }

  for (const handle of handles) {
    try {
      const user = await fetchUser(handle);
      if (!user) continue;
      const tweets = await fetchTweetsForUser(user.id);
      for (const tweet of tweets) {
        await saveTweet(tweet, user);
      }
    } catch (error) {
      console.error(`[Hotspot] 同步 ${handle} 推文失败`, error);
    }
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  await HotTweet.deleteMany({ postedAt: { $lt: cutoff } });
}

export function startHotspotPolling() {
  if (!hotspotEnabled) {
    console.log('[Hotspot] 功能已关闭');
    return;
  }
  if (!bearerToken || !handles.length) {
    console.warn('[Hotspot] 缺少 X API 配置, 热点推文功能已跳过');
    return;
  }
  if (pollingTimer) {
    return;
  }
  console.log('[Hotspot] 启动热点推文轮询');
  syncHotTweets().catch((err) => console.error('[Hotspot] 初始化同步失败', err));
  pollingTimer = setInterval(() => {
    syncHotTweets().catch((err) => console.error('[Hotspot] 同步失败', err));
  }, Math.max(fetchInterval, 60000));
}
