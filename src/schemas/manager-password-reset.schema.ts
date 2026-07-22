import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ManagerPasswordResetDocument = ManagerPasswordReset & Document;

@Schema({ timestamps: true })
export class ManagerPasswordReset {
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true })
  tokenHash: string;

  @Prop({ required: true, default: false })
  used: boolean;

  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;
}

export const ManagerPasswordResetSchema = SchemaFactory.createForClass(ManagerPasswordReset);
