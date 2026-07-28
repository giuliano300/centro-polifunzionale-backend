import * as bcrypt from 'bcrypt';
import mongoose, { Types } from 'mongoose';
import { BookingSchema } from '../schemas/booking.schema';
import { CourseSchema } from '../schemas/course.schema';
import { CourseBookingSchema } from '../schemas/course-booking.schema';
import { DiscountCodeSchema } from '../schemas/discount-code.schema';
import { NotificationSchema } from '../schemas/notification.schema';
import { PaymentSchema } from '../schemas/payment.schema';
import { SpaceSchema } from '../schemas/space.schema';
import { SystemSettingsSchema } from '../schemas/system-settings.schema';
import { UserSchema } from '../schemas/user.schema';
import { WalletMovementSchema } from '../schemas/wallet-movement.schema';
import { CourseApprovalStatus } from '../courses/course-approval-status.enum';
import { CourseTag } from '../courses/course-tag.enum';
import { PaymentMethod } from '../payments/payment-method.enum';
import { UserRole } from '../roles/user-role.enum';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/centro-db';
const demoPassword = process.env.DEMO_PASSWORD || 'Demo123!';

const UserModel = mongoose.model('User', UserSchema);
const SpaceModel = mongoose.model('Space', SpaceSchema);
const BookingModel = mongoose.model('Booking', BookingSchema);
const PaymentModel = mongoose.model('Payment', PaymentSchema);
const CourseModel = mongoose.model('Course', CourseSchema);
const CourseBookingModel = mongoose.model('CourseBooking', CourseBookingSchema);
const WalletMovementModel = mongoose.model('WalletMovement', WalletMovementSchema);
const DiscountCodeModel = mongoose.model('DiscountCode', DiscountCodeSchema);
const NotificationModel = mongoose.model('Notification', NotificationSchema);
const SystemSettingsModel = mongoose.model('SystemSettings', SystemSettingsSchema);

const demoEmails = [
  'admin@nagora.demo',
  'mario.rossi@nagora.demo',
  'laura.bianchi@nagora.demo',
  'giulia.verdi@nagora.demo',
  'andrea.neri@nagora.demo',
];

function dayFromNow(offset: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function futureWeekday(dayOffset: number, targetDay: number): Date {
  const date = dayFromNow(dayOffset);
  while (date.getDay() !== targetDay) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function dateLabel(value: Date): string {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
}

function objectId(value: unknown): Types.ObjectId {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

async function upsertUser(data: {
  name: string;
  email: string;
  phone: string;
  taxCode: string;
  role: UserRole;
  interestedTags?: CourseTag[];
}) {
  const password = await bcrypt.hash(demoPassword, 10);
  return UserModel.findOneAndUpdate(
    { email: data.email },
    {
      $set: {
        ...data,
        password,
        isActive: true,
        registrationStatus: 'complete',
        interestedTags: data.interestedTags || [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
}

async function upsertSpace(data: Record<string, unknown>) {
  return SpaceModel.findOneAndUpdate(
    { name: data.name },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
}

function weeklyHours(openTime: string, closeTime: string, maxConsecutiveTimeSlots: number, weekend = false) {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    isOpen: weekend ? day !== 0 : day >= 1 && day <= 6,
    openTime,
    closeTime,
    maxConsecutiveTimeSlots,
  }));
}

async function createBooking(data: {
  user: Types.ObjectId;
  space: Types.ObjectId;
  date: Date;
  name: string;
  startTime: string;
  endTime: string;
  rentalUnit: 'whole_room' | 'workstation';
  rentalMode: 'time' | 'full_day';
  workstationQuantity?: number;
  status: 'pending' | 'confirmed' | 'cancellation_requested' | 'cancelled';
}) {
  return BookingModel.create({
    ...data,
    workstationQuantity: data.workstationQuantity || 1,
  });
}

async function createPayment(data: {
  bookingId: Types.ObjectId;
  amount: number;
  totalAmount: number;
  walletAmount: number;
  externalAmount: number;
  originalAmount?: number;
  discountAmount?: number;
  discountCode?: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  method: string;
  provider?: 'manual' | 'stripe' | 'paypal' | 'nexi';
  transactionId?: string;
}) {
  return PaymentModel.create({
    originalAmount: data.totalAmount,
    discountAmount: 0,
    provider: 'manual',
    ...data,
  });
}

async function seedDemo() {
  await mongoose.connect(mongoUri);

  const [admin, managerMario, managerLaura, clientGiulia, clientAndrea] = await Promise.all([
    upsertUser({
      name: 'Admin Demo',
      email: 'admin@nagora.demo',
      phone: '3310000001',
      taxCode: 'DMOMDA80A01F839A',
      role: UserRole.Admin,
    }),
    upsertUser({
      name: 'Mario Rossi',
      email: 'mario.rossi@nagora.demo',
      phone: '3310000002',
      taxCode: 'RSSMRA80A01F839X',
      role: UserRole.Gestore,
      interestedTags: [CourseTag.Benessere, CourseTag.Formazione],
    }),
    upsertUser({
      name: 'Laura Bianchi',
      email: 'laura.bianchi@nagora.demo',
      phone: '3310000003',
      taxCode: 'BNCLRA82B41F839Y',
      role: UserRole.Gestore,
      interestedTags: [CourseTag.Creativita, CourseTag.Eventi],
    }),
    upsertUser({
      name: 'Giulia Verdi',
      email: 'giulia.verdi@nagora.demo',
      phone: '3310000004',
      taxCode: 'VRDGLI90C51F839Z',
      role: UserRole.Cliente,
      interestedTags: [CourseTag.Benessere, CourseTag.Movimento, CourseTag.Socialita],
    }),
    upsertUser({
      name: 'Andrea Neri',
      email: 'andrea.neri@nagora.demo',
      phone: '3310000005',
      taxCode: 'NRENDR88D11F839W',
      role: UserRole.Cliente,
      interestedTags: [CourseTag.Lavoro, CourseTag.Formazione],
    }),
  ]);

  await SystemSettingsModel.findOneAndUpdate(
    { key: 'wallet' },
    { $set: { key: 'wallet', newUserWalletCredit: 0, newClientWalletCredit: 15, newManagerWalletCredit: 25 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  const [yogaSpace, coworkingSpace, kidsSpace, danceSpace] = await Promise.all([
    upsertSpace({
      name: 'Sala Yoga/Pilates Demo',
      description: 'Sala luminosa per corsi benessere, movimento e piccoli gruppi.',
      hourlyRate: 20,
      dailyRate: 120,
      rentalUnit: 'whole_room',
      rentalModes: ['time', 'full_day'],
      timeSlotMinutes: 30,
      maxConsecutiveTimeSlots: 4,
      workstationCount: 1,
      courseCreationAdvanceHours: 2,
      paymentMethods: [PaymentMethod.Cash, PaymentMethod.Stripe, PaymentMethod.Paypal],
      openingHours: weeklyHours('08:00', '21:00', 4),
      exceptionalClosures: [{ startDate: dayFromNow(18), endDate: dayFromNow(19), reason: 'Manutenzione demo' }],
      isAvailable: true,
    }),
    upsertSpace({
      name: 'Coworking Open Space Demo',
      description: 'Area coworking acquistabile a postazioni, con fasce orarie consecutive.',
      hourlyRate: 8,
      dailyRate: 35,
      rentalUnit: 'workstation',
      rentalModes: ['time', 'full_day'],
      timeSlotMinutes: 60,
      maxConsecutiveTimeSlots: 6,
      workstationCount: 12,
      courseCreationAdvanceHours: 1,
      paymentMethods: [PaymentMethod.Cash, PaymentMethod.Stripe, PaymentMethod.Nexi],
      openingHours: weeklyHours('08:00', '20:00', 6),
      exceptionalClosures: [],
      isAvailable: true,
    }),
    upsertSpace({
      name: 'Sala Bambini Demo',
      description: 'Spazio dedicato a laboratori, attivita famiglia e corsi per bambini.',
      hourlyRate: 18,
      dailyRate: 100,
      rentalUnit: 'whole_room',
      rentalModes: ['time'],
      timeSlotMinutes: 60,
      maxConsecutiveTimeSlots: 3,
      workstationCount: 1,
      courseCreationAdvanceHours: 3,
      paymentMethods: [PaymentMethod.Cash, PaymentMethod.Paypal],
      openingHours: weeklyHours('09:00', '18:00', 3, true),
      exceptionalClosures: [],
      isAvailable: true,
    }),
    upsertSpace({
      name: 'Sala Balli Caraibici Demo',
      description: 'Sala serale per danza, eventi sociali e movimento.',
      hourlyRate: 25,
      dailyRate: 0,
      rentalUnit: 'whole_room',
      rentalModes: ['time'],
      timeSlotMinutes: 60,
      maxConsecutiveTimeSlots: 5,
      workstationCount: 1,
      courseCreationAdvanceHours: 2,
      paymentMethods: [PaymentMethod.Cash, PaymentMethod.Stripe, PaymentMethod.Paypal, PaymentMethod.Nexi],
      openingHours: weeklyHours('17:00', '23:30', 5, true),
      exceptionalClosures: [],
      isAvailable: true,
    }),
  ]);

  const demoUserIds = [admin, managerMario, managerLaura, clientGiulia, clientAndrea].map((user) => objectId(user._id));
  const demoSpaceIds = [yogaSpace, coworkingSpace, kidsSpace, danceSpace].map((space) => objectId(space._id));

  const demoBookings = await BookingModel.find({ user: { $in: demoUserIds }, space: { $in: demoSpaceIds } }).select('_id').exec();
  const demoBookingIds = demoBookings.map((booking) => objectId(booking._id));
  const demoCourses = await CourseModel.find({ booking: { $in: demoBookingIds } }).select('_id').exec();
  const demoCourseIds = demoCourses.map((course) => objectId(course._id));
  const demoCourseBookings = await CourseBookingModel.find({ course: { $in: demoCourseIds } }).select('_id').exec();
  const demoCourseBookingIds = demoCourseBookings.map((item) => objectId(item._id));

  await Promise.all([
    CourseBookingModel.deleteMany({ course: { $in: demoCourseIds } }).exec(),
    CourseModel.deleteMany({ booking: { $in: demoBookingIds } }).exec(),
    PaymentModel.deleteMany({ bookingId: { $in: demoBookingIds } }).exec(),
    WalletMovementModel.deleteMany({
      $or: [
        { user: { $in: demoUserIds } },
        { booking: { $in: demoBookingIds } },
        { courseBooking: { $in: demoCourseBookingIds } },
      ],
    }).exec(),
    NotificationModel.deleteMany({
      $or: [
        { user: { $in: demoUserIds } },
        { message: /Demo|demo|Mario Rossi|Laura Bianchi|Giulia Verdi|Andrea Neri/ },
      ],
    }).exec(),
    BookingModel.deleteMany({ _id: { $in: demoBookingIds } }).exec(),
    DiscountCodeModel.deleteMany({ code: { $in: ['WELCOME10', 'CORSI20', 'COWORKING5'] } }).exec(),
  ]);

  await WalletMovementModel.create([
    {
      user: managerMario._id,
      type: 'credit',
      reason: 'signup_bonus',
      amount: 25,
      currency: 'EUR',
      description: 'Premio registrazione gestore demo',
    },
    {
      user: managerLaura._id,
      type: 'credit',
      reason: 'signup_bonus',
      amount: 25,
      currency: 'EUR',
      description: 'Premio registrazione gestore demo',
    },
    {
      user: clientGiulia._id,
      type: 'credit',
      reason: 'signup_bonus',
      amount: 15,
      currency: 'EUR',
      description: 'Premio registrazione cliente demo',
    },
    {
      user: clientAndrea._id,
      type: 'credit',
      reason: 'signup_bonus',
      amount: 15,
      currency: 'EUR',
      description: 'Premio registrazione cliente demo',
    },
  ]);

  const yogaDate = futureWeekday(6, 1);
  const danceDate = futureWeekday(8, 3);
  const kidsDate = futureWeekday(10, 6);
  const coworkingDate = futureWeekday(4, 2);
  const cancellationDate = futureWeekday(12, 4);

  const [yogaBooking, danceBooking, kidsBooking, coworkingBooking, cancellationBooking] = await Promise.all([
    createBooking({
      user: objectId(managerMario._id),
      space: objectId(yogaSpace._id),
      date: yogaDate,
      name: 'Demo prenotazione Sala Yoga',
      startTime: '09:00',
      endTime: '11:00',
      rentalUnit: 'whole_room',
      rentalMode: 'time',
      status: 'confirmed',
    }),
    createBooking({
      user: objectId(managerMario._id),
      space: objectId(danceSpace._id),
      date: danceDate,
      name: 'Demo prenotazione Salsa',
      startTime: '19:00',
      endTime: '21:00',
      rentalUnit: 'whole_room',
      rentalMode: 'time',
      status: 'confirmed',
    }),
    createBooking({
      user: objectId(managerLaura._id),
      space: objectId(kidsSpace._id),
      date: kidsDate,
      name: 'Demo prenotazione Laboratorio bambini',
      startTime: '10:00',
      endTime: '12:00',
      rentalUnit: 'whole_room',
      rentalMode: 'time',
      status: 'confirmed',
    }),
    createBooking({
      user: objectId(managerLaura._id),
      space: objectId(coworkingSpace._id),
      date: coworkingDate,
      name: 'Demo coworking mezza giornata',
      startTime: '09:00',
      endTime: '13:00',
      rentalUnit: 'workstation',
      rentalMode: 'time',
      workstationQuantity: 3,
      status: 'pending',
    }),
    createBooking({
      user: objectId(managerMario._id),
      space: objectId(yogaSpace._id),
      date: cancellationDate,
      name: 'Demo richiesta annullamento',
      startTime: '15:00',
      endTime: '16:00',
      rentalUnit: 'whole_room',
      rentalMode: 'time',
      status: 'cancellation_requested',
    }),
  ]);

  await Promise.all([
    createPayment({
      bookingId: objectId(yogaBooking._id),
      amount: 15,
      totalAmount: 40,
      walletAmount: 25,
      externalAmount: 15,
      status: 'PAID',
      method: 'cash',
      provider: 'manual',
      transactionId: 'DEMO-CASH-YOGA',
    }),
    createPayment({
      bookingId: objectId(danceBooking._id),
      amount: 50,
      totalAmount: 50,
      walletAmount: 0,
      externalAmount: 50,
      status: 'PAID',
      method: 'stripe',
      provider: 'stripe',
      transactionId: 'DEMO-STRIPE-DANCE',
    }),
    createPayment({
      bookingId: objectId(kidsBooking._id),
      amount: 36,
      totalAmount: 36,
      walletAmount: 0,
      externalAmount: 36,
      status: 'PAID',
      method: 'paypal',
      provider: 'paypal',
      transactionId: 'DEMO-PAYPAL-KIDS',
    }),
    createPayment({
      bookingId: objectId(coworkingBooking._id),
      amount: 96,
      totalAmount: 96,
      walletAmount: 0,
      externalAmount: 96,
      status: 'PENDING',
      method: 'manual',
      provider: 'manual',
    }),
    createPayment({
      bookingId: objectId(cancellationBooking._id),
      amount: 20,
      totalAmount: 20,
      walletAmount: 0,
      externalAmount: 20,
      status: 'PAID',
      method: 'cash',
      provider: 'manual',
      transactionId: 'DEMO-CASH-CANCEL',
    }),
  ]);

  await WalletMovementModel.create({
    user: managerMario._id,
    booking: yogaBooking._id,
    type: 'debit',
    reason: 'booking_payment',
    amount: 25,
    currency: 'EUR',
    description: 'Utilizzo wallet demo su prenotazione Sala Yoga',
  });

  const [pilatesCourse, salsaCourse, kidsCourse] = await CourseModel.create([
    {
      title: 'Pilates posturale Demo',
      description: 'Percorso guidato per postura, mobilita e respirazione.',
      tags: [CourseTag.Benessere, CourseTag.Movimento, CourseTag.Relax],
      bannerImageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=80',
      cardImageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=80',
      date: yogaDate,
      startTime: '09:30',
      endTime: '10:30',
      booking: yogaBooking._id,
      capacity: 12,
      enrollmentType: 'paid',
      price: 20,
      isPublished: true,
      approvalStatus: CourseApprovalStatus.Approved,
      approvedAt: new Date(),
      approvedBy: admin._id,
      participants: [clientGiulia._id],
    },
    {
      title: 'Master class di Salsa Demo',
      description: 'Lezione energica di salsa con passi base, ritmo e socialita.',
      tags: [CourseTag.Energia, CourseTag.Socialita, CourseTag.Movimento],
      bannerImageUrl: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?auto=format&fit=crop&w=1600&q=80',
      cardImageUrl: 'https://images.unsplash.com/photo-1545959570-a94084071b5d?auto=format&fit=crop&w=900&q=80',
      date: danceDate,
      startTime: '19:30',
      endTime: '20:30',
      booking: danceBooking._id,
      capacity: 20,
      enrollmentType: 'paid',
      price: 35,
      isPublished: true,
      approvalStatus: CourseApprovalStatus.Approved,
      approvedAt: new Date(),
      approvedBy: admin._id,
      participants: [],
    },
    {
      title: 'Laboratorio creativo bambini Demo',
      description: 'Attivita manuale e creativa per bambini e famiglie.',
      tags: [CourseTag.Bambini, CourseTag.Famiglia, CourseTag.Creativita],
      bannerImageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&q=80',
      cardImageUrl: 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=900&q=80',
      date: kidsDate,
      startTime: '10:30',
      endTime: '11:30',
      booking: kidsBooking._id,
      capacity: 10,
      enrollmentType: 'free',
      price: 0,
      isPublished: false,
      approvalStatus: CourseApprovalStatus.Pending,
      participants: [],
    },
  ]);

  const giuliaCourseBooking = await CourseBookingModel.create({
    user: clientGiulia._id,
    course: pilatesCourse._id,
    status: 'confirmed',
    enrollmentType: 'paid',
    amount: 5,
    totalAmount: 20,
    walletAmount: 15,
    externalAmount: 5,
    originalAmount: 20,
    discountAmount: 0,
    paymentMethod: PaymentMethod.Cash,
    paymentStatus: 'PAID',
  });

  await WalletMovementModel.create({
    user: clientGiulia._id,
    courseBooking: giuliaCourseBooking._id,
    type: 'debit',
    reason: 'course_payment',
    amount: 15,
    currency: 'EUR',
    description: 'Utilizzo wallet demo su iscrizione Pilates',
  });

  await DiscountCodeModel.create([
    {
      code: 'WELCOME10',
      title: 'Benvenuto nuovi clienti',
      description: 'Sconto automatico/manuale del 10% per i nuovi clienti demo.',
      isAutomatic: false,
      type: 'percentage',
      value: 10,
      target: 'all',
      spaces: [],
      userRoles: [UserRole.Cliente],
      rule: 'new_user',
      newUserDays: 30,
      isActive: true,
      validFrom: dayFromNow(-2),
      validTo: dayFromNow(60),
      usedCount: 0,
    },
    {
      code: 'CORSI20',
      title: 'Promo corsi benessere',
      description: 'Sconto demo sui corsi nello spazio Yoga.',
      isAutomatic: false,
      type: 'fixed',
      value: 20,
      target: 'course',
      spaces: [yogaSpace._id],
      userRoles: [UserRole.Cliente],
      rule: 'manual',
      isActive: true,
      validFrom: dayFromNow(-2),
      validTo: dayFromNow(90),
      usedCount: 0,
    },
    {
      code: 'COWORKING5',
      title: 'Coworking demo',
      description: 'Sconto automatico del 5% sulle prenotazioni coworking.',
      isAutomatic: true,
      type: 'percentage',
      value: 5,
      target: 'booking',
      spaces: [coworkingSpace._id],
      userRoles: [UserRole.Gestore],
      rule: 'manual',
      isActive: true,
      validFrom: dayFromNow(-2),
      validTo: dayFromNow(90),
      usedCount: 0,
    },
  ]);

  await NotificationModel.create([
    {
      audience: 'admin',
      title: 'Nuovo acquisto spazio',
      message: `Mario Rossi ha acquistato Sala Yoga/Pilates Demo per il ${dateLabel(yogaDate)}.`,
      type: 'booking_created',
      link: `/bookings?month=${yogaDate.getMonth() + 1}&year=${yogaDate.getFullYear()}`,
    },
    {
      audience: 'admin',
      title: 'Corso da approvare',
      message: `Laura Bianchi ha creato Laboratorio creativo bambini Demo per il ${dateLabel(kidsDate)}.`,
      type: 'course_created',
      link: `/courses?month=${kidsDate.getMonth() + 1}&year=${kidsDate.getFullYear()}`,
    },
    {
      audience: 'admin',
      title: 'Richiesta annullamento',
      message: `Mario Rossi ha richiesto l annullamento di Sala Yoga/Pilates Demo del ${dateLabel(cancellationDate)}.`,
      type: 'booking_cancellation_requested',
      link: '/cancellation-requests',
    },
    {
      audience: 'gestore',
      user: managerMario._id,
      title: 'Nuova iscrizione corso',
      message: `Giulia Verdi si e iscritta a Pilates posturale Demo per il ${dateLabel(yogaDate)}.`,
      type: 'course_booking_created',
      link: `/courses?courseId=${pilatesCourse._id}`,
    },
  ]);

  console.log('Seed demo completato.');
  console.log('');
  console.log('Credenziali demo');
  console.log(`Admin:    admin@nagora.demo / ${demoPassword}`);
  console.log(`Gestore:  mario.rossi@nagora.demo / ${demoPassword}`);
  console.log(`Gestore:  laura.bianchi@nagora.demo / ${demoPassword}`);
  console.log(`Cliente:  giulia.verdi@nagora.demo / ${demoPassword}`);
  console.log(`Cliente:  andrea.neri@nagora.demo / ${demoPassword}`);
  console.log('');
  console.log('Dati demo creati: spazi, prenotazioni, pagamenti, corsi, iscrizione corso, wallet, promo e notifiche.');
}

seedDemo()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
