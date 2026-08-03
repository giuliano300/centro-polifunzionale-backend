import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CourseChatModerationEvent extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }) user: mongoose.Types.ObjectId;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true }) course: mongoose.Types.ObjectId;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'CourseChatRoom', required: true }) room: mongoose.Types.ObjectId;
  @Prop({ required: true, enum: ['language', 'insult', 'threat', 'discrimination'] }) category: 'language' | 'insult' | 'threat' | 'discrimination';
  @Prop({ required: true, min: 1, max: 3 }) severity: number;
  @Prop({ required: true, enum: ['warning', 'allowed_after_warning', 'blocked', 'suspended'] }) action: 'warning' | 'allowed_after_warning' | 'blocked' | 'suspended';
  @Prop({ maxlength: 2000 }) messageText?: string;
  @Prop() mutedUntil?: Date;
}

export const CourseChatModerationEventSchema = SchemaFactory.createForClass(CourseChatModerationEvent);
CourseChatModerationEventSchema.index({ user: 1, createdAt: -1 });
