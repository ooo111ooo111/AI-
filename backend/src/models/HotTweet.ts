import mongoose, { Schema, Document } from 'mongoose';

export interface IHotTweet extends Document {
  tweetId: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  text: string;
  postedAt: Date;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  url: string;
  keywords?: string[];
}

const HotTweetSchema = new Schema<IHotTweet>(
  {
    tweetId: { type: String, unique: true, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorHandle: { type: String, required: true },
    authorAvatar: { type: String, required: true },
    text: { type: String, required: true },
    postedAt: { type: Date, required: true },
    likeCount: { type: Number, default: 0 },
    retweetCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    quoteCount: { type: Number, default: 0 },
    url: { type: String, required: true },
    keywords: { type: [String], default: [] },
  },
  { timestamps: true }
);

HotTweetSchema.index({ postedAt: -1 });

export default mongoose.model<IHotTweet>('HotTweet', HotTweetSchema);
