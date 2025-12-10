import { RequestHandler } from 'express';
import HotTweet from '../models/HotTweet';

export const listHotTweets: RequestHandler = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const cursor = req.query.cursor ? new Date(String(req.query.cursor)) : null;

    const query: Record<string, any> = {};
    if (cursor) {
      query.postedAt = { $lt: cursor };
    }

    const tweets = await HotTweet.find(query)
      .sort({ postedAt: -1 })
      .limit(limit)
      .lean();

    res.json({ tweets });
  } catch (error) {
    console.error('获取热点信息失败:', error);
    res.status(500).json({ message: '获取热点信息失败' });
  }
};
