import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CreatePaymentDto } from "../../dto/create-payment.dto";
import { PaymentService } from "../../services/payment.service";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "src/roles/roles.decorator";
import { RolesGuard } from "src/roles/roles.guard";

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore')
  async create(@Body() dto: CreatePaymentDto) {
    return await this.paymentService.create(dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore')
  async findAll(@Query('status') status?: string) {
    return await this.paymentService.findAll(status);
  }

  @Get('by-booking/:bookingId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore')
  async getByBooking(@Param('bookingId') bookingId: string) {
    return await this.paymentService.findByBooking(bookingId);
  }
}
