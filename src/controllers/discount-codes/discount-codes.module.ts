import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscountCodesController } from './discount-codes.controller';
import { DiscountCode, DiscountCodeSchema } from 'src/schemas/discount-code.schema';
import { DiscountCodeService } from 'src/services/discount-code.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: DiscountCode.name, schema: DiscountCodeSchema }])],
  controllers: [DiscountCodesController],
  providers: [DiscountCodeService],
  exports: [DiscountCodeService],
})
export class DiscountCodesModule {}
