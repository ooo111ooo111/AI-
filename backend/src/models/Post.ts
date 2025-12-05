import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  title: string;
  content: string;
  excerpt: string;
  coverImage?: string;
  author: string;
  category: mongoose.Types.ObjectId;
  tags: mongoose.Types.ObjectId[];
  slug: string;
  published: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    excerpt: { type: String, required: true, maxlength: 200 },
    coverImage: { type: String },
    author: { type: String, required: true, default: '管理员' },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
    slug: { type: String, required: true, unique: true },
    published: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// 索引
PostSchema.index({ title: 'text', content: 'text' });
PostSchema.index({ slug: 1 });
PostSchema.index({ createdAt: -1 });

export default mongoose.model<IPost>('Post', PostSchema);
