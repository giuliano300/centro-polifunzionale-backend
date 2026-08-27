import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CreatePaymentDto } from "../../dto/create-payment.dto";
import { ConfirmPaymentDto } from "../../dto/confirm-payment.dto";
import { CreateCheckoutDto } from "../../dto/create-checkout.dto";
import { PaymentService } from "../../services/payment.service";
import { AuthGuard } from "@nestjs/passport";
import { Roles, UserRole } from "src/roles/roles.decorator";
import { RolesGuard } from "src/roles/roles.guard";

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhooks/stripe')
  async stripeWebhook(@Req() req, @Headers('stripe-signature') signature?: string) {
    return this.paymentService.handleStripeWebhook(req.rawBody, signature || '');
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  async create(@Body() dto: CreatePaymentDto, @Req() req) {
    if (dto.status === 'PAID') {
      return await this.paymentService.confirmBookingPayment(
        dto.bookingId,
        {
          amount: dto.amount,
          method: dto.method,
          transactionId: dto.transactionId,
        },
        req.user.role === UserRole.Gestore ? req.user.userId : undefined,
      );
    }

    return await this.paymentService.create(dto);
  }

  @Post('booking/:bookingId/confirm')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
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
      req.user.role === UserRole.Gestore ? req.user.userId : undefined,
    );
  }

  @Post('booking/:bookingId/checkout')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
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
      req.user.role === UserRole.Admin ? undefined : req.user.userId,
    );
  }

  @Post('booking/:bookingId/stripe-complete')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async completeStripeCheckout(
    @Param('bookingId') bookingId: string,
    @Body() dto: { sessionId: string },
    @Req() req,
  ) {
    return this.paymentService.completeStripeCheckout(
      bookingId,
      dto.sessionId,
      req.user.role === UserRole.Admin ? undefined : req.user.userId,
    );
  }

  @Post('booking/:bookingId/send-payment-link')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  async sendPaymentLink(
    @Param('bookingId') bookingId: string,
    @Req() req,
  ) {
    return await this.paymentService.sendBookingPaymentLink(
      bookingId,
      req.user.role === UserRole.Gestore ? req.user.userId : undefined,
    );
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
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
      userId: req.user.role === UserRole.Gestore ? req.user.userId : undefined,
    });
  }

  @Get('by-booking/:bookingId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async getByBooking(@Param('bookingId') bookingId: string, @Req() req) {
    return await this.paymentService.findByBooking(
      bookingId,
      req.user.role === UserRole.Cliente || req.user.role === UserRole.Gestore ? req.user.userId : undefined,
    );
  }
}
