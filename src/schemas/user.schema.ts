import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { UserRole, USER_ROLE_VALUES } from 'src/roles/user-role.enum';

export type UserDocument = User & Document;


@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ unique: true, sparse: true })
  phone?: string;

  @Prop({ unique: true, sparse: true })
  taxCode?: string;

  @Prop({ required: true })
  password: string;

 @Prop({ required: true, enum: USER_ROLE_VALUES, default: UserRole.Cliente })
  role: UserRole;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true, enum: ['complete', 'invited'], default: 'complete' })
  registrationStatus: 'complete' | 'invited';

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  invitedBy?: mongoose.Types.ObjectId;

  @Prop()
  completionTokenHash?: string;

  @Prop()
  completionTokenExpiresAt?: Date;

  @Prop()
  completionPhoneOtpHash?: string;

  @Prop()
  completionPhoneOtpTarget?: string;

  @Prop()
  completionPhoneOtpExpiresAt?: Date;

  @Prop()
  profilePhoneOtpHash?: string;

  @Prop()
  profilePhoneOtpTarget?: string;

  @Prop()
  profilePhoneOtpExpiresAt?: Date;

  @Prop({ type: [String], default: [] })
  interestedTags: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
