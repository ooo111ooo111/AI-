import { useEffect, useState } from 'react';
import { hotspotService } from '../services/hotspotService';
import type { HotTweet } from '../types';
import { formatDistanceToNow } from 'date-fns';

const formatRelative = (value: string) => {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch (error) {
    return value;
  }
};

export default function HotspotPage() {
  const [tweets, setTweets] = useState<HotTweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadTweets = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const data = await hotspotService.getTweets({ limit: 60 });
      setTweets(data);
    } catch (err: any) {
      console.error('加载热点推文失败', err);
      setError(err?.response?.data?.message || '加载热点推文失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTweets();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">热点信息</h1>
          <p className="text-gray-400 text-sm">
            自动抓取名人推文，聚焦币圈相关信号
          </p>
        </div>
        <button
          onClick={() => loadTweets(true)}
          disabled={loading || refreshing}
          className={`px-4 py-2 rounded-xl border border-white/20 text-sm ${
            loading || refreshing ? 'text-gray-500 cursor-not-allowed' : 'text-white hover:border-white/40'
          }`}
        >
          {refreshing || loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-10">热点推文加载中...</div>
      ) : tweets.length === 0 ? (
        <div className="text-center text-gray-500 py-10">暂时没有相关热点。</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tweets.map((tweet) => (
            <article key={tweet.tweetId} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={tweet.authorAvatar}
                  alt={tweet.authorName}
                  className="w-12 h-12 rounded-full object-cover border border-white/10"
                />
                <div>
                  <p className="text-white font-semibold">
                    {tweet.authorName}
                    <span className="text-gray-500 text-sm ml-2">@{tweet.authorHandle}</span>
                  </p>
                  <p className="text-xs text-gray-500">{formatRelative(tweet.postedAt)}</p>
                </div>
              </div>
              <p className="text-gray-100 whitespace-pre-wrap leading-relaxed">{tweet.text}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <span>赞 {tweet.likeCount}</span>
                <span>转发 {tweet.retweetCount}</span>
                <span>回复 {tweet.replyCount}</span>
                <span>引用 {tweet.quoteCount}</span>
              </div>
              {tweet.keywords && tweet.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {tweet.keywords.map((keyword) => (
                    <span key={keyword} className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-200 border border-blue-500/30">
                      #{keyword}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <a
                  href={tweet.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-200"
                >
                  查看推文 ↗
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
