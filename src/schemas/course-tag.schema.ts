import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CourseTagDocument = CourseTagEntity & Document;

@Schema({ timestamps: true })
export class CourseTagEntity {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  value: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}

export const CourseTagSchema = SchemaFactory.createForClass(CourseTagEntity);
