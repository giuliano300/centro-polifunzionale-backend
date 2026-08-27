import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SpacesModule } from './controllers/spaces/spaces.module';
import { AuthModule } from './controllers/auth/auth.module';
import { UsersModule } from './controllers/users/users.module';
import { AppService } from './app.service';
import { BookingsModule } from './controllers/booking/booking.module';
import { CourseBookingModule } from './controllers/course-booking/course-booking.module';
import { CoursesModule } from './controllers/courses/courses.module';
import { PaymentModule } from './controllers/payment/payment.module';
import { DashboardModule } from './controllers/dashboard/dashboard.module';
import { WalletModule } from './controllers/wallet/wallet.module';
import { NotificationsModule } from './controllers/notifications/notifications.module';
import { SystemSettingsModule } from './controllers/system-settings/system-settings.module';
import { DiscountCodesModule } from './controllers/discount-codes/discount-codes.module';
import { CourseTagsModule } from './controllers/course-tags/course-tags.module';
import { CourseChatModule } from './controllers/course-chat/course-chat.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27017/nagora-db'),
      }),
    }),
    SpacesModule,
    AuthModule,
    UsersModule,
    BookingsModule,
    CoursesModule,
    CourseBookingModule,
    PaymentModule,
    DashboardModule,
    WalletModule,
    NotificationsModule,
    SystemSettingsModule,
    DiscountCodesModule,
    CourseTagsModule,
    CourseChatModule
  ],
  controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
