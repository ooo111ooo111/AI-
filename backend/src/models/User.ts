import mongoose, { Schema, Document } from 'mongoose';

// OAuth 账号子文档接口
export interface IOAuthAccount {
  provider: 'qq' | 'google';
  providerId: string;           // QQ openid / Google ID
  profile: any;                 // 第三方返回的原始 profile
  connectedAt: Date;
}

// User 文档接口
export interface IGateSettings {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  nickname?: string;
  isEnabled: boolean;
  updatedAt: Date;
}

export interface IQuantAccess {
  hasAccess: boolean;
  invitationCode?: string;
  grantedAt?: Date;
}

export interface IUser extends Document {
  email?: string;
  nickname: string;
  avatar?: string;
  accounts: IOAuthAccount[];
  quantAccess?: IQuantAccess;
  gateSettings?: IGateSettings;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

// OAuth 账号子模式
const OAuthAccountSchema = new Schema<IOAuthAccount>({
  provider: { type: String, enum: ['qq', 'google'], required: true },
  providerId: { type: String, required: true },
  profile: { type: Schema.Types.Mixed },
  connectedAt: { type: Date, default: Date.now }
}, { _id: false });

// User 主模式
const GateSettingSchema = new Schema<IGateSettings>(
  {
    apiKey: { type: String, required: true },
    apiSecret: { type: String, required: true, select: false },
    passphrase: { type: String },
    nickname: { type: String },
    isEnabled: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, trim: true, lowercase: true },
    nickname: { type: String, required: true, trim: true },
    avatar: { type: String },
    accounts: [OAuthAccountSchema],
    lastLoginAt: { type: Date, default: Date.now },
    quantAccess: {
      hasAccess: { type: Boolean, default: false },
      invitationCode: { type: String },
      grantedAt: { type: Date }
    },
    gateSettings: GateSettingSchema
  },
  { timestamps: true }
);

// 索引
UserSchema.index({ email: 1 });
UserSchema.index({ 'accounts.provider': 1, 'accounts.providerId': 1 }, { unique: true });
UserSchema.index({ 'quantAccess.invitationCode': 1 });

export default mongoose.model<IUser>('User', UserSchema);
