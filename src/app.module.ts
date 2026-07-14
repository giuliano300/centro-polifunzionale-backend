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
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27017/centro-db'),
      }),
    }),
    SpacesModule,
    AuthModule,
    UsersModule,
    BookingsModule,
    CoursesModule,
    CourseBookingModule,
    PaymentModule,
    DashboardModule
  ],
  controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
