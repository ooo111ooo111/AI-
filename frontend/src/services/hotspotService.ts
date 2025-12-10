import api from './api';
import type { HotTweet } from '../types';

export const hotspotService = {
  async getTweets(params?: { limit?: number; cursor?: string }) {
    const response = await api.get<{ tweets: HotTweet[] }>('/hotspots/tweets', {
      params,
    });
    return response.data.tweets;
  },
};
