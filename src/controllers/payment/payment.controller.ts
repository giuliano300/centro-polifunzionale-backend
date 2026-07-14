import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CreatePaymentDto } from "../../dto/create-payment.dto";
import { ConfirmPaymentDto } from "../../dto/confirm-payment.dto";
import { CreateCheckoutDto } from "../../dto/create-checkout.dto";
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
  async create(@Body() dto: CreatePaymentDto, @Req() req) {
    if (dto.status === 'PAID') {
      return await this.paymentService.confirmBookingPayment(
        dto.bookingId,
        {
          amount: dto.amount,
          method: dto.method,
          transactionId: dto.transactionId,
        },
        req.user.role === 'gestore' ? req.user.userId : undefined,
      );
    }

    return await this.paymentService.create(dto);
  }

  @Post('booking/:bookingId/confirm')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore')
  async confirmBookingPayment(
    @Param('bookingId') bookingId: string,
    @Body() dto: ConfirmPaymentDto,
    @Req() req,
  ) {
    return await this.paymentService.confirmBookingPayment(
      bookingId,
      {
        amount: dto.amount,
        method: dto.method || 'manual',
        transactionId: dto.transactionId,
      },
      req.user.role === 'gestore' ? req.user.userId : undefined,
    );
  }

  @Post('booking/:bookingId/checkout')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async createCheckout(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateCheckoutDto,
    @Req() req,
  ) {
    return await this.paymentService.createCheckoutSession(
      bookingId,
      dto.provider,
      {
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
      },
      req.user.role === 'admin' ? undefined : req.user.userId,
    );
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore')
  async findAll(
    @Query('status') status?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('search') search?: string,
    @Req() req?,
  ) {
    return await this.paymentService.findAll({
      status,
      start,
      end,
      search,
      userId: req.user.role === 'gestore' ? req.user.userId : undefined,
    });
  }

  @Get('by-booking/:bookingId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async getByBooking(@Param('bookingId') bookingId: string, @Req() req) {
    return await this.paymentService.findByBooking(
      bookingId,
      req.user.role === 'cliente' || req.user.role === 'gestore' ? req.user.userId : undefined,
    );
  }
}
