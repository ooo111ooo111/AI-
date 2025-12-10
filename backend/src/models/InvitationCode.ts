import mongoose, { Document, Schema } from 'mongoose';

export interface IInvitationCode extends Document {
  code: string;
  description?: string;
  maxRedemptions?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationCodeSchema = new Schema<IInvitationCode>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String },
    maxRedemptions: { type: Number },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
    lastUsedAt: { type: Date },
    createdBy: { type: String },
    notes: { type: String }
  },
  { timestamps: true }
);

InvitationCodeSchema.index({ code: 1 }, { unique: true });
InvitationCodeSchema.index({ isActive: 1, expiresAt: 1 });

export default mongoose.model<IInvitationCode>('InvitationCode', InvitationCodeSchema);
