import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Payment } from '../schemas/payment.schema';
import { FilterQuery, Model, Types } from 'mongoose';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { Booking, BookingDocument } from 'src/schemas/booking.schema';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_PAYMENT_METHODS, PaymentMethod } from '../payments/payment-method.enum';
import { NotificationsService } from './notifications.service';

type SearchablePayment = Payment & {
  bookingId?: {
    date?: Date;
    name?: string;
    user?: {
      _id?: string;
      name?: string;
      email?: string;
    };
    space?: {
      name?: string;
    };
  };
};

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    if (createPaymentDto.status === 'PAID') {
      return this.confirmBookingPayment(createPaymentDto.bookingId, {
        amount: createPaymentDto.amount,
        method: createPaymentDto.method,
        transactionId: createPaymentDto.transactionId,
      });
    }

    const existingPending = await this.paymentModel.findOne({
      bookingId: new Types.ObjectId(createPaymentDto.bookingId),
      status: 'PENDING',
    }).exec();

    if (existingPending && createPaymentDto.status === 'PENDING') {
      existingPending.amount = createPaymentDto.amount;
      existingPending.totalAmount = existingPending.totalAmount || createPaymentDto.amount;
      existingPending.externalAmount = createPaymentDto.amount;
      existingPending.walletAmount = existingPending.walletAmount || 0;
      existingPending.method = createPaymentDto.method;
      existingPending.transactionId = createPaymentDto.transactionId;
      return existingPending.save();
    }

    const payment = await this.paymentModel.create({
      ...createPaymentDto,
      totalAmount: createPaymentDto.amount,
      walletAmount: 0,
      externalAmount: createPaymentDto.amount,
    });
    return payment;
  }

  async confirmBookingPayment(
    bookingId: string,
    options: { amount?: number; method?: string; transactionId?: string } = {},
    allowedUserId?: string,
  ): Promise<Payment> {
    const booking = await this.assertBookingAccess(bookingId, allowedUserId);
    if (booking.status === 'expired' || (booking.status === 'pending' && booking.holdExpiresAt && booking.holdExpiresAt <= new Date())) {
      throw new BadRequestException('Il tempo di priorita della prenotazione e scaduto');
    }
    const method = options.method || 'manual';
    this.assertPaymentMethodAllowed(booking, method);
    const bookingObjectId = new Types.ObjectId(bookingId);

    const alreadyPaid = await this.paymentModel.findOne({
      bookingId: bookingObjectId,
      status: 'PAID',
    }).sort({ updatedAt: -1, createdAt: -1 }).exec();

    if (alreadyPaid) {
      await this.closeDuplicatePending(bookingObjectId, alreadyPaid._id);
      await this.bookingModel.findByIdAndUpdate(bookingId, { $set: { status: 'confirmed' }, $unset: { holdExpiresAt: 1 } }).exec();
      return alreadyPaid;
    }

    const pending = await this.paymentModel.findOne({
      bookingId: bookingObjectId,
      status: 'PENDING',
    }).sort({ createdAt: 1 }).exec();

    const amount = options.amount ?? pending?.amount;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Importo pagamento non valido');
    }

    const payment = pending || new this.paymentModel({
      bookingId: bookingObjectId,
      amount,
      totalAmount: amount,
      walletAmount: 0,
      externalAmount: amount,
    });

    payment.amount = amount;
    payment.externalAmount = amount;
    payment.totalAmount = payment.totalAmount || amount;
    payment.walletAmount = payment.walletAmount || 0;
    payment.status = 'PAID';
    payment.method = method;
    payment.provider = method === PaymentMethod.Cash ? 'manual' : payment.provider || 'manual';
    payment.transactionId = options.transactionId || `MANUAL-${Date.now()}`;
    const saved = await payment.save();

    await this.closeDuplicatePending(bookingObjectId, saved._id);
    await this.bookingModel.findByIdAndUpdate(bookingId, { $set: { status: 'confirmed' }, $unset: { holdExpiresAt: 1 } }).exec();
    await this.notifyPaymentConfirmed(bookingId, saved.amount, method);
    return saved;
  }

  async createCheckoutSession(
    bookingId: string,
    provider: 'stripe' | 'paypal' | 'nexi',
    options: { successUrl?: string; cancelUrl?: string } = {},
    allowedUserId?: string,
  ): Promise<{ provider: string; paymentId: string; checkoutUrl: string; transactionId?: string }> {
    const booking = await this.assertBookingAccess(bookingId, allowedUserId);
    this.assertPaymentMethodAllowed(booking, provider);
    const payment = await this.getOrCreatePendingPayment(bookingId);
    if (payment.provider === provider && payment.checkoutUrl && payment.transactionId) {
      return {
        provider,
        paymentId: (payment._id as Types.ObjectId).toString(),
        checkoutUrl: payment.checkoutUrl,
        transactionId: payment.transactionId,
      };
    }
    const amount = payment.amount;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Importo pagamento non valido');
    }

    const successUrl = options.successUrl || this.configService.get<string>('PAYMENT_SUCCESS_URL', 'http://localhost:4400/bookings?payment=success');
    const cancelUrl = options.cancelUrl || this.configService.get<string>('PAYMENT_CANCEL_URL', 'http://localhost:4400/bookings?payment=cancel');
    const description = booking.name || `Prenotazione ${bookingId}`;

    const checkout = provider === 'stripe'
      ? await this.createStripeCheckout(bookingId, amount, description, successUrl, cancelUrl)
      : provider === 'paypal'
        ? await this.createPaypalCheckout(bookingId, amount, description, successUrl, cancelUrl)
        : await this.createNexiCheckout(bookingId, amount, description, successUrl, cancelUrl);

    payment.provider = provider;
    payment.method = provider;
    payment.externalAmount = amount;
    payment.totalAmount = payment.totalAmount || amount;
    payment.walletAmount = payment.walletAmount || 0;
    payment.transactionId = checkout.transactionId;
    payment.checkoutUrl = checkout.checkoutUrl;
    payment.providerPayload = checkout.providerPayload ? JSON.stringify(checkout.providerPayload) : undefined;
    const saved = await payment.save();

    return {
      provider,
      paymentId: (saved._id as Types.ObjectId).toString(),
      checkoutUrl: checkout.checkoutUrl,
      transactionId: checkout.transactionId,
    };
  }

  async sendBookingPaymentLink(
    bookingId: string,
    allowedUserId?: string,
  ): Promise<{ sent: boolean; email?: string; paymentId: string; paymentUrl: string }> {
    await this.assertBookingAccess(bookingId, allowedUserId);
    const payment = await this.getOrCreatePendingPayment(bookingId);
    const populatedBooking = await this.bookingModel.findById(bookingId).populate('user').exec();
    const user = populatedBooking?.user as unknown as { email?: string } | undefined;
    const frontUrl = this.configService.get<string>('GESTORE_FRONTEND_URL', 'http://localhost:4400');
    const paymentUrl = `${frontUrl.replace(/\/$/, '')}/bookings?bookingId=${bookingId}&payment=pending`;

    payment.checkoutUrl = paymentUrl;
    payment.method = payment.method || 'manual';
    payment.provider = payment.provider || 'manual';
    await payment.save();

    return {
      sent: false,
      email: user?.email,
      paymentId: (payment._id as Types.ObjectId).toString(),
      paymentUrl,
    };
  }

  async findAll(filters: { status?: string; start?: string; end?: string; search?: string; userId?: string } = {}): Promise<Payment[]> {
    const query: FilterQuery<Payment> = {};
    if (filters.status) query.status = filters.status;

    const payments = await this.paymentModel
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .populate({
        path: 'bookingId',
        populate: [
          { path: 'user' },
          { path: 'space' },
        ],
      })
      .exec();

    const normalizedSearch = filters.search?.trim().toLowerCase();
    return (payments as SearchablePayment[]).filter((payment) => {
      const booking = payment.bookingId;
      const bookingDate = booking?.date ? new Date(booking.date) : null;
      const inStart = !filters.start || (bookingDate && bookingDate >= new Date(filters.start));
      const inEnd = !filters.end || (bookingDate && bookingDate <= new Date(filters.end));
      const inUser = !filters.userId || booking?.user?._id?.toString() === filters.userId;
      const text = [
        payment.status,
        payment.method,
        payment.transactionId,
        booking?.name,
        booking?.user?.name,
        booking?.user?.email,
        booking?.space?.name,
      ].join(' ').toLowerCase();

      return !!inStart && !!inEnd && inUser && (!normalizedSearch || text.includes(normalizedSearch));
    });
  }

  async findByBooking(bookingId: string, allowedUserId?: string): Promise<Payment[]> {
    await this.assertBookingAccess(bookingId, allowedUserId);

    return await this.paymentModel.find({ bookingId: new Types.ObjectId(bookingId) }).sort({ createdAt: -1, _id: -1 }).exec();
  }

  private async assertBookingAccess(bookingId: string, allowedUserId?: string): Promise<BookingDocument> {
    const booking = await this.bookingModel.findById(bookingId).populate('space').exec();
    if (!booking) {
      throw new NotFoundException('Prenotazione non trovata');
    }

    if (allowedUserId && booking.user.toString() !== allowedUserId) {
      throw new ForbiddenException('Pagamenti non accessibili');
    }

    return booking;
  }

  private assertPaymentMethodAllowed(booking: BookingDocument, method: string): void {
    if (method === 'manual') {
      return;
    }

    const space = booking.space as unknown as { paymentMethods?: string[] } | undefined;
    const paymentMethods = space?.paymentMethods?.length ? space.paymentMethods : DEFAULT_PAYMENT_METHODS;

    if (!paymentMethods.includes(method)) {
      throw new BadRequestException('Metodo di pagamento non disponibile per questo spazio');
    }
  }

  private async closeDuplicatePending(bookingId: Types.ObjectId, keepPaymentId?: unknown): Promise<void> {
    const query: FilterQuery<Payment> = {
      bookingId,
      status: 'PENDING',
    };

    if (keepPaymentId) {
      query._id = { $ne: keepPaymentId };
    }

    await this.paymentModel.updateMany(query, {
      $set: {
        status: 'FAILED',
        method: 'duplicate_closed',
      },
    }).exec();
  }

  private async getOrCreatePendingPayment(bookingId: string): Promise<Payment> {
    const bookingObjectId = new Types.ObjectId(bookingId);
    const paid = await this.paymentModel.findOne({ bookingId: bookingObjectId, status: 'PAID' }).exec();
    if (paid) {
      throw new BadRequestException('Prenotazione gia pagata');
    }

    const pending = await this.paymentModel.findOne({ bookingId: bookingObjectId, status: 'PENDING' }).sort({ createdAt: 1 }).exec();
    if (pending) {
      return pending;
    }

    throw new BadRequestException('Pagamento pending non trovato');
  }

  private async notifyPaymentConfirmed(bookingId: string, amount: number, method: string): Promise<void> {
    const booking = await this.bookingModel.findById(bookingId).populate('user').populate('space').exec();
    const manager = booking?.user as unknown as { name?: string; email?: string } | undefined;
    const space = booking?.space as unknown as { name?: string } | undefined;
    const amountLabel = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount || 0);

    await this.notificationsService.create({
      audience: 'admin',
      title: 'Pagamento confermato',
      message: `${manager?.name || manager?.email || 'Gestore'} ha confermato un pagamento di ${amountLabel} per ${space?.name || 'uno spazio'} del ${this.formatNotificationDate(booking?.date || new Date())}. Metodo: ${this.getPaymentMethodLabel(method)}.`,
      type: 'payment_confirmed',
      link: this.monthLink('/payments', booking?.date || new Date()),
    });
  }

  private getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      manual: 'Pagamento manuale',
      stripe: 'Stripe',
      paypal: 'PayPal',
      nexi: 'Nexi',
      card: 'Carta',
      cash: 'Contanti',
      wallet: 'Wallet',
    };

    return labels[String(method || '').toLowerCase()] || method || 'Pagamento';
  }

  private monthLink(basePath: string, value: string | Date): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return basePath;
    }

    return `${basePath}?month=${date.getMonth() + 1}&year=${date.getFullYear()}`;
  }

  private formatNotificationDate(value: string | Date): string {
    return new Date(value).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private async createStripeCheckout(
    bookingId: string,
    amount: number,
    description: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ checkoutUrl: string; transactionId: string; providerPayload: unknown }> {
    const secret = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secret) {
      throw new BadRequestException('Stripe non configurato: manca STRIPE_SECRET_KEY');
    }

    const body = new URLSearchParams();
    body.set('mode', 'payment');
    body.set('success_url', this.appendPaymentParams(successUrl, { provider: 'stripe', bookingId, session_id: '{CHECKOUT_SESSION_ID}' }));
    body.set('cancel_url', this.appendPaymentParams(cancelUrl, { provider: 'stripe', bookingId }));
    body.set('line_items[0][quantity]', '1');
    body.set('line_items[0][price_data][currency]', 'eur');
    body.set('line_items[0][price_data][unit_amount]', Math.round(amount * 100).toString());
    body.set('line_items[0][price_data][product_data][name]', description);
    body.set('metadata[bookingId]', bookingId);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = await response.json();
    if (!response.ok || !data.url) {
      throw new BadRequestException(data?.error?.message || 'Checkout Stripe non creato');
    }

    return { checkoutUrl: data.url, transactionId: data.id, providerPayload: data };
  }

  private async createPaypalCheckout(
    bookingId: string,
    amount: number,
    description: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ checkoutUrl: string; transactionId: string; providerPayload: unknown }> {
    const clientId = this.configService.get<string>('PAYPAL_CLIENT_ID');
    const secret = this.configService.get<string>('PAYPAL_CLIENT_SECRET');
    if (!clientId || !secret) {
      throw new BadRequestException('PayPal non configurato: mancano PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET');
    }

    const baseUrl = this.configService.get<string>('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com');
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new BadRequestException('Token PayPal non ottenuto');
    }

    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: bookingId,
          description,
          amount: {
            currency_code: 'EUR',
            value: amount.toFixed(2),
          },
        }],
        application_context: {
          return_url: this.appendPaymentParams(successUrl, { provider: 'paypal', bookingId }),
          cancel_url: this.appendPaymentParams(cancelUrl, { provider: 'paypal', bookingId }),
        },
      }),
    });

    const orderData = await orderResponse.json();
    const approve = orderData?.links?.find((link) => link.rel === 'approve')?.href;
    if (!orderResponse.ok || !approve) {
      throw new BadRequestException(orderData?.message || 'Checkout PayPal non creato');
    }

    return { checkoutUrl: approve, transactionId: orderData.id, providerPayload: orderData };
  }

  private async createNexiCheckout(
    bookingId: string,
    amount: number,
    description: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ checkoutUrl: string; transactionId: string; providerPayload: unknown }> {
    const hppUrl = this.configService.get<string>('NEXI_HPP_URL');
    const apiKey = this.configService.get<string>('NEXI_API_KEY');
    if (!hppUrl || !apiKey) {
      throw new BadRequestException('Nexi non configurato: mancano NEXI_HPP_URL/NEXI_API_KEY');
    }

    const orderId = `BK-${bookingId}-${Date.now()}`;
    const response = await fetch(hppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': apiKey,
      },
      body: JSON.stringify({
        order: {
          orderId,
          amount: Math.round(amount * 100),
          currency: 'EUR',
          description,
        },
        paymentSession: {
          actionType: 'PAY',
          amount: Math.round(amount * 100),
          language: 'ITA',
          resultUrl: this.appendPaymentParams(successUrl, { provider: 'nexi', bookingId, orderId }),
          cancelUrl: this.appendPaymentParams(cancelUrl, { provider: 'nexi', bookingId, orderId }),
          paymentService: 'cards',
        },
      }),
    });

    const data = await response.json();
    const checkoutUrl = data.hostedPage || data.hostedPageUrl || data.redirectUrl;
    if (!response.ok || !checkoutUrl) {
      throw new BadRequestException(data?.message || 'Checkout Nexi non creato');
    }

    return { checkoutUrl, transactionId: orderId, providerPayload: data };
  }

  private appendPaymentParams(url: string, params: Record<string, string>): string {
    const parsed = new URL(url);
    Object.entries(params).forEach(([key, value]) => parsed.searchParams.set(key, value));
    return parsed.toString();
  }
}
