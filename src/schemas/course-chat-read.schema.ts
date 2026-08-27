import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CourseChatRead extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'CourseChatRoom', required: true }) room: mongoose.Types.ObjectId;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }) user: mongoose.Types.ObjectId;
  @Prop({ required: true, default: Date.now }) lastReadAt: Date;
}
export const CourseChatReadSchema = SchemaFactory.createForClass(CourseChatRead);
CourseChatReadSchema.index({ room: 1, user: 1 }, { unique: true });
