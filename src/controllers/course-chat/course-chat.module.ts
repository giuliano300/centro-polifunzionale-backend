import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CourseChatController } from './course-chat.controller';
import { CourseChatService } from 'src/services/course-chat.service';
import { CourseChatMessage, CourseChatMessageSchema } from 'src/schemas/course-chat-message.schema';
import { Course, CourseSchema } from 'src/schemas/course.schema';
import { CourseBooking, CourseBookingSchema } from 'src/schemas/course-booking.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { CourseChatRoom, CourseChatRoomSchema } from 'src/schemas/course-chat-room.schema';
import { CourseChatRead, CourseChatReadSchema } from 'src/schemas/course-chat-read.schema';
import { CourseChatModerationEvent, CourseChatModerationEventSchema } from 'src/schemas/course-chat-moderation-event.schema';
import { User, UserSchema } from 'src/schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: CourseChatMessage.name, schema: CourseChatMessageSchema },
    { name: Course.name, schema: CourseSchema },
    { name: CourseBooking.name, schema: CourseBookingSchema },
    { name: CourseChatRoom.name, schema: CourseChatRoomSchema },
    { name: CourseChatRead.name, schema: CourseChatReadSchema },
    { name: CourseChatModerationEvent.name, schema: CourseChatModerationEventSchema },
    { name: User.name, schema: UserSchema },
  ]), NotificationsModule],
  controllers: [CourseChatController], providers: [CourseChatService],
})
export class CourseChatModule {}
