import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
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
  async findAll(
    @Query('status') status?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('search') search?: string,
  ) {
    return await this.paymentService.findAll({ status, start, end, search });
  }

  @Get('by-booking/:bookingId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async getByBooking(@Param('bookingId') bookingId: string, @Req() req) {
    return await this.paymentService.findByBooking(
      bookingId,
      req.user.role === 'cliente' ? req.user.userId : undefined,
    );
  }
}
