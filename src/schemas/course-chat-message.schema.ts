import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CourseChatMessage extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true }) course: mongoose.Types.ObjectId;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }) sender: mongoose.Types.ObjectId;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'CourseChatRoom', index: true }) room?: mongoose.Types.ObjectId;
  @Prop({ required: true, maxlength: 2000 }) text: string;
}
export const CourseChatMessageSchema = SchemaFactory.createForClass(CourseChatMessage);
