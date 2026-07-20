import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from '../../services/users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from '../../schemas/user.schema';
import { WalletModule } from '../wallet/wallet.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    WalletModule,
    SystemSettingsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // 👈 serve per AuthModule
})
export class UsersModule {}
