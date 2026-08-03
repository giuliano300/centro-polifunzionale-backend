import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CourseChatRoom extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true }) course: mongoose.Types.ObjectId;
  @Prop({ required: true, maxlength: 80 }) title: string;
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }) createdBy: mongoose.Types.ObjectId;
  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] }) members: mongoose.Types.ObjectId[];
  @Prop({ default: false }) isGeneral: boolean;
  @Prop({ index: true, unique: true, sparse: true }) directKey?: string;
}
export const CourseChatRoomSchema = SchemaFactory.createForClass(CourseChatRoom);
