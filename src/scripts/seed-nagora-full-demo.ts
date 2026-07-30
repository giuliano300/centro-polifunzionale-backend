import * as bcrypt from 'bcrypt';
import mongoose, { Types } from 'mongoose';
import { BookingSchema } from '../schemas/booking.schema';
import { ClientRegistrationOtpSchema } from '../schemas/client-registration-otp.schema';
import { CourseBookingSchema } from '../schemas/course-booking.schema';
import { CourseSchema } from '../schemas/course.schema';
import { CourseTagSchema } from '../schemas/course-tag.schema';
import { DiscountCodeSchema } from '../schemas/discount-code.schema';
import { ManagerPasswordResetSchema } from '../schemas/manager-password-reset.schema';
import { ManagerRegistrationOtpSchema } from '../schemas/manager-registration-otp.schema';
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

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nagora-db';
const demoPassword = process.env.DEMO_PASSWORD || 'Demo123!';
const preservedEmail = 'valente.giuliano11@gmail.com';

const UserModel = mongoose.model('User', UserSchema);
const SpaceModel = mongoose.model('Space', SpaceSchema);
const BookingModel = mongoose.model('Booking', BookingSchema);
const PaymentModel = mongoose.model('Payment', PaymentSchema);
const CourseModel = mongoose.model('Course', CourseSchema);
const CourseTagModel = mongoose.model('CourseTagEntity', CourseTagSchema);
const CourseBookingModel = mongoose.model('CourseBooking', CourseBookingSchema);
const WalletMovementModel = mongoose.model('WalletMovement', WalletMovementSchema);
const DiscountCodeModel = mongoose.model('DiscountCode', DiscountCodeSchema);
const NotificationModel = mongoose.model('Notification', NotificationSchema);
const SystemSettingsModel = mongoose.model('SystemSettings', SystemSettingsSchema);
const ClientRegistrationOtpModel = mongoose.model('ClientRegistrationOtp', ClientRegistrationOtpSchema);
const ManagerRegistrationOtpModel = mongoose.model('ManagerRegistrationOtp', ManagerRegistrationOtpSchema);
const ManagerPasswordResetModel = mongoose.model('ManagerPasswordReset', ManagerPasswordResetSchema);

type DemoUser = {
  name: string;
  email: string;
  phone: string;
  taxCode: string;
  role: UserRole;
  interestedTags?: CourseTag[];
};

type DemoBooking = {
  user: Types.ObjectId;
  space: Types.ObjectId;
  date: Date;
  name: string;
  startTime: string;
  endTime: string;
  rentalUnit: 'whole_room' | 'workstation';
  rentalMode: 'time' | 'full_day';
  sectorIndexes?: number[];
  sectorQuantity?: number;
  workstationQuantity?: number;
  totalAmount: number;
  walletAmount: number;
  method: PaymentMethod;
};

const imagePairs = [
  {
    banner: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=85',
    card: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=85',
  },
  {
    banner: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?auto=format&fit=crop&w=1600&q=85',
    card: 'https://images.unsplash.com/photo-1545959570-a94084071b5d?auto=format&fit=crop&w=900&q=85',
  },
  {
    banner: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1600&q=85',
    card: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=85',
  },
  {
    banner: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&q=85',
    card: 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=900&q=85',
  },
  {
    banner: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=85',
    card: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=85',
  },
  {
    banner: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1600&q=85',
    card: 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=900&q=85',
  },
  {
    banner: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=85',
    card: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=85',
  },
  {
    banner: 'https://images.unsplash.com/photo-1499728603263-13726abce5fd?auto=format&fit=crop&w=1600&q=85',
    card: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=900&q=85',
  },
];

const courseCatalog = [
  ['Respiro del Golfo', [CourseTag.Benessere, CourseTag.Relax]],
  ['Corpo in equilibrio', [CourseTag.Movimento, CourseTag.Benessere]],
  ['Laboratorio luce e tufo', [CourseTag.Creativita, CourseTag.Eventi]],
  ['Scrittura vista mare', [CourseTag.Formazione, CourseTag.Creativita]],
  ['Ritmo urbano', [CourseTag.Energia, CourseTag.Socialita]],
  ['Mindfulness al mattino', [CourseTag.Relax, CourseTag.Benessere]],
  ['Public speaking gentile', [CourseTag.Formazione, CourseTag.Lavoro]],
  ['Atelier piccoli esploratori', [CourseTag.Bambini, CourseTag.Famiglia]],
  ['Design del tempo', [CourseTag.Lavoro, CourseTag.Formazione]],
  ['Movimento consapevole', [CourseTag.Movimento, CourseTag.Relax]],
] as const;

const defaultCourseTags = [
  { value: CourseTag.Benessere, label: 'Benessere', sortOrder: 10 },
  { value: CourseTag.Movimento, label: 'Movimento', sortOrder: 20 },
  { value: CourseTag.Energia, label: 'Energia', sortOrder: 30 },
  { value: CourseTag.Relax, label: 'Relax', sortOrder: 40 },
  { value: CourseTag.Famiglia, label: 'Famiglia', sortOrder: 50 },
  { value: CourseTag.Bambini, label: 'Bambini', sortOrder: 60 },
  { value: CourseTag.Formazione, label: 'Formazione', sortOrder: 70 },
  { value: CourseTag.Lavoro, label: 'Lavoro', sortOrder: 80 },
  { value: CourseTag.Creativita, label: 'Creativita', sortOrder: 90 },
  { value: CourseTag.Socialita, label: 'Socialita', sortOrder: 100 },
  { value: CourseTag.Eventi, label: 'Eventi', sortOrder: 110 },
];

function objectId(value: unknown): Types.ObjectId {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

function makeDate(month: number, day: number): Date {
  return new Date(2026, month - 1, day, 0, 0, 0, 0);
}

function weeklyHours(openTime: string, closeTime: string, maxConsecutiveTimeSlots: number, weekend = true) {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    isOpen: weekend ? day !== 0 : day >= 1 && day <= 5,
    openTime,
    closeTime,
    maxConsecutiveTimeSlots,
  }));
}

function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function dateLabel(value: Date): string {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
}

async function createUser(data: DemoUser, passwordHash: string) {
  return UserModel.create({
    ...data,
    email: data.email.toLowerCase(),
    taxCode: data.taxCode.toUpperCase(),
    password: passwordHash,
    isActive: true,
    registrationStatus: 'complete',
    interestedTags: data.interestedTags || [],
  });
}

async function resetDatabase(preservedUser: any) {
  await Promise.all([
    BookingModel.deleteMany({}).exec(),
    PaymentModel.deleteMany({}).exec(),
    CourseModel.deleteMany({}).exec(),
    CourseTagModel.deleteMany({}).exec(),
    CourseBookingModel.deleteMany({}).exec(),
    WalletMovementModel.deleteMany({}).exec(),
    DiscountCodeModel.deleteMany({}).exec(),
    NotificationModel.deleteMany({}).exec(),
    SpaceModel.deleteMany({}).exec(),
    SystemSettingsModel.deleteMany({}).exec(),
    ClientRegistrationOtpModel.deleteMany({}).exec(),
    ManagerRegistrationOtpModel.deleteMany({}).exec(),
    ManagerPasswordResetModel.deleteMany({}).exec(),
  ]);

  await UserModel.deleteMany({ email: { $ne: preservedEmail } }).exec();

  if (preservedUser) {
    await UserModel.updateOne(
      { _id: preservedUser._id },
      {
        $set: {
          email: preservedEmail,
          name: preservedUser.name || 'Giuliano Valente',
          role: preservedUser.role || UserRole.Admin,
          isActive: true,
          registrationStatus: 'complete',
          interestedTags: preservedUser.interestedTags || [
            CourseTag.Benessere,
            CourseTag.Formazione,
            CourseTag.Socialita,
          ],
        },
      },
    ).exec();
  }
}

async function createPaymentForBooking(booking: any, data: DemoBooking) {
  const externalAmount = Math.max(data.totalAmount - data.walletAmount, 0);
  await PaymentModel.create({
    bookingId: booking._id,
    amount: externalAmount,
    totalAmount: data.totalAmount,
    walletAmount: data.walletAmount,
    externalAmount,
    originalAmount: data.totalAmount,
    discountAmount: 0,
    status: 'PAID',
    method: data.method,
    provider: data.method === PaymentMethod.Cash ? 'manual' : data.method,
    transactionId: `DEMO-${data.method.toUpperCase()}-${booking._id.toString().slice(-6)}`,
  });

  if (data.walletAmount > 0) {
    await WalletMovementModel.create({
      user: data.user,
      booking: booking._id,
      type: 'debit',
      reason: 'booking_payment',
      amount: data.walletAmount,
      currency: 'EUR',
      description: `Utilizzo wallet sulla prenotazione ${data.name}`,
    });
  }
}

async function main() {
  await mongoose.connect(mongoUri);

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const preservedUser = await UserModel.findOne({ email: preservedEmail }).lean().exec();
  await resetDatabase(preservedUser);

  const valente = await UserModel.findOne({ email: preservedEmail }).exec()
    || await createUser({
      name: 'Giuliano Valente',
      email: preservedEmail,
      phone: '3770983152',
      taxCode: 'VLNGLN80A01F839A',
      role: UserRole.Admin,
      interestedTags: [CourseTag.Benessere, CourseTag.Formazione, CourseTag.Socialita],
    }, passwordHash);

  const [adminDemo, managerElena, managerDario, ...clients] = await Promise.all([
    createUser({
      name: 'Admin N Agora',
      email: 'admin@nagora.demo',
      phone: '3317000001',
      taxCode: 'DMONRA80A01F839K',
      role: UserRole.Admin,
    }, passwordHash),
    createUser({
      name: 'Elena Sannino',
      email: 'elena.sannino@nagora.demo',
      phone: '3317000002',
      taxCode: 'SNNLNE84A41F839P',
      role: UserRole.Gestore,
      interestedTags: [CourseTag.Benessere, CourseTag.Movimento, CourseTag.Eventi],
    }, passwordHash),
    createUser({
      name: 'Dario Ferrara',
      email: 'dario.ferrara@nagora.demo',
      phone: '3317000003',
      taxCode: 'FRRDRA82B12F839Q',
      role: UserRole.Gestore,
      interestedTags: [CourseTag.Formazione, CourseTag.Lavoro, CourseTag.Creativita],
    }, passwordHash),
    createUser({
      name: 'Giulia Verdi',
      email: 'giulia.verdi@nagora.demo',
      phone: '3317000004',
      taxCode: 'VRDGLI90C51F839Z',
      role: UserRole.Cliente,
      interestedTags: [CourseTag.Benessere, CourseTag.Movimento, CourseTag.Relax],
    }, passwordHash),
    createUser({
      name: 'Andrea Neri',
      email: 'andrea.neri@nagora.demo',
      phone: '3317000005',
      taxCode: 'NRENDR88D11F839W',
      role: UserRole.Cliente,
      interestedTags: [CourseTag.Lavoro, CourseTag.Formazione],
    }, passwordHash),
    createUser({
      name: 'Sara De Luca',
      email: 'sara.deluca@nagora.demo',
      phone: '3317000006',
      taxCode: 'DLCSRA91D61F839R',
      role: UserRole.Cliente,
      interestedTags: [CourseTag.Creativita, CourseTag.Eventi, CourseTag.Socialita],
    }, passwordHash),
    createUser({
      name: 'Paolo Esposito',
      email: 'paolo.esposito@nagora.demo',
      phone: '3317000007',
      taxCode: 'SPSPLA86E21F839S',
      role: UserRole.Cliente,
      interestedTags: [CourseTag.Energia, CourseTag.Movimento],
    }, passwordHash),
    createUser({
      name: 'Marta Russo',
      email: 'marta.russo@nagora.demo',
      phone: '3317000008',
      taxCode: 'RSSMRT89H41F839T',
      role: UserRole.Cliente,
      interestedTags: [CourseTag.Famiglia, CourseTag.Bambini, CourseTag.Creativita],
    }, passwordHash),
    createUser({
      name: 'Luca Romano',
      email: 'luca.romano@nagora.demo',
      phone: '3317000009',
      taxCode: 'RMNLCU87L11F839U',
      role: UserRole.Cliente,
      interestedTags: [CourseTag.Benessere, CourseTag.Socialita, CourseTag.Formazione],
    }, passwordHash),
  ]);

  await SystemSettingsModel.create({
    key: 'wallet',
    newUserWalletCredit: 0,
    newClientWalletCredit: 20,
    newManagerWalletCredit: 35,
  });

  await CourseTagModel.create(defaultCourseTags.map((tag) => ({ ...tag, isActive: true })));

  const [salaChiaia, salaSanita, coworking] = await SpaceModel.create([
    {
      name: 'Sala Parthenope',
      description: 'Stanza elegante e modulabile ispirata alla luce del golfo, ideale per movimento, benessere e incontri culturali.',
      hourlyRate: 42,
      dailyRate: 260,
      rentalUnit: 'whole_room',
      rentalModes: ['time', 'full_day'],
      timeSlotMinutes: 60,
      maxConsecutiveTimeSlots: 4,
      workstationCount: 1,
      sectorEnabled: true,
      sectorCount: 2,
      sectorNames: ['Sirena', 'Golfo'],
      calendarColor: '#9ec5fe',
      sectorColors: ['#b7d7ff', '#c7ead1'],
      sectorRate: 24,
      sectorDailyRate: 145,
      courseCreationAdvanceHours: 2,
      paymentMethods: [PaymentMethod.Cash, PaymentMethod.Stripe, PaymentMethod.Paypal, PaymentMethod.Nexi],
      openingHours: weeklyHours('08:00', '22:00', 4),
      exceptionalClosures: [{ startDate: makeDate(9, 16), endDate: makeDate(9, 17), reason: 'Allestimento speciale' }],
      isAvailable: true,
    },
    {
      name: 'Sala Sebeto',
      description: 'Stanza raccolta e contemporanea ispirata alla Napoli sotterranea e ai percorsi d acqua della citta.',
      hourlyRate: 38,
      dailyRate: 230,
      rentalUnit: 'whole_room',
      rentalModes: ['time', 'full_day'],
      timeSlotMinutes: 60,
      maxConsecutiveTimeSlots: 5,
      workstationCount: 1,
      sectorEnabled: true,
      sectorCount: 2,
      sectorNames: ['Tufo', 'Ninfeo'],
      calendarColor: '#f7c59f',
      sectorColors: ['#fbd0aa', '#b9e4c9'],
      sectorRate: 22,
      sectorDailyRate: 135,
      courseCreationAdvanceHours: 2,
      paymentMethods: [PaymentMethod.Cash, PaymentMethod.Stripe, PaymentMethod.Paypal],
      openingHours: weeklyHours('09:00', '21:00', 5),
      exceptionalClosures: [{ startDate: makeDate(8, 21), endDate: makeDate(8, 21), reason: 'Evento privato' }],
      isAvailable: true,
    },
    {
      name: 'Coworking Partenope',
      description: 'Postazioni flessibili e silenziose per lavorare nel cuore di una Napoli operosa e contemporanea.',
      hourlyRate: 9,
      dailyRate: 38,
      rentalUnit: 'workstation',
      rentalModes: ['time', 'full_day'],
      timeSlotMinutes: 60,
      maxConsecutiveTimeSlots: 6,
      workstationCount: 14,
      sectorEnabled: false,
      sectorCount: 1,
      sectorNames: [],
      calendarColor: '#d8dee9',
      sectorColors: [],
      sectorRate: 0,
      sectorDailyRate: 0,
      courseCreationAdvanceHours: 1,
      paymentMethods: [PaymentMethod.Cash, PaymentMethod.Stripe, PaymentMethod.Nexi],
      openingHours: weeklyHours('08:00', '20:00', 6, false),
      exceptionalClosures: [],
      isAvailable: true,
    },
  ]);

  const managers = [managerElena, managerDario];
  const bookingDates = [
    [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
    [8, 18], [8, 19], [8, 20], [8, 24], [8, 25], [9, 1], [9, 2], [9, 3], [9, 4], [9, 7],
    [9, 8], [9, 9], [9, 10], [9, 11], [9, 14], [9, 18], [9, 21], [9, 22], [9, 24], [9, 28],
  ];
  const startTimes = ['09:00', '10:30', '12:00', '15:00', '17:00', '18:30'];

  const normalBookingDocs: any[] = [];
  for (let index = 0; index < bookingDates.length; index += 1) {
    const space = index % 2 === 0 ? salaChiaia : salaSanita;
    const sectorMode = index % 3 !== 0;
    const selectedSectors = sectorMode ? [index % 2] : [0, 1];
    const startTime = startTimes[index % startTimes.length];
    const endTime = addMinutes(startTime, 90);
    const manager = managers[index % managers.length];
    const totalAmount = sectorMode ? Number(space.sectorRate) * 1.5 : Number(space.hourlyRate) * 1.5;
    const bookingData: DemoBooking = {
      user: objectId(manager._id),
      space: objectId(space._id),
      date: makeDate(bookingDates[index][0], bookingDates[index][1]),
      name: `${space.name} - ${sectorMode ? space.sectorNames[selectedSectors[0]] : 'Stanza intera'}`,
      startTime,
      endTime,
      rentalUnit: 'whole_room',
      rentalMode: 'time',
      sectorIndexes: selectedSectors,
      sectorQuantity: selectedSectors.length,
      totalAmount,
      walletAmount: index < 4 ? 10 : 0,
      method: index % 4 === 0 ? PaymentMethod.Cash : index % 4 === 1 ? PaymentMethod.Stripe : index % 4 === 2 ? PaymentMethod.Paypal : PaymentMethod.Nexi,
    };

    const booking = await BookingModel.create({
      user: bookingData.user,
      space: bookingData.space,
      date: bookingData.date,
      name: bookingData.name,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      rentalUnit: bookingData.rentalUnit,
      rentalMode: bookingData.rentalMode,
      sectorIndexes: bookingData.sectorIndexes,
      sectorQuantity: bookingData.sectorQuantity,
      workstationQuantity: 1,
      status: 'confirmed',
    });
    await createPaymentForBooking(booking, bookingData);
    normalBookingDocs.push(booking);
  }

  const coworkingBookings: any[] = [];
  const coworkingDates = [[8, 6], [8, 17], [8, 27], [9, 8], [9, 23]];
  for (let index = 0; index < coworkingDates.length; index += 1) {
    const client = clients[index % clients.length];
    const quantity = 1 + (index % 3);
    const startTime = ['09:00', '10:00', '14:00', '15:00', '11:00'][index];
    const endTime = addMinutes(startTime, 120);
    const totalAmount = quantity * Number(coworking.hourlyRate) * 2;
    const data: DemoBooking = {
      user: objectId(client._id),
      space: objectId(coworking._id),
      date: makeDate(coworkingDates[index][0], coworkingDates[index][1]),
      name: `Postazione ${coworking.name}`,
      startTime,
      endTime,
      rentalUnit: 'workstation',
      rentalMode: 'time',
      workstationQuantity: quantity,
      totalAmount,
      walletAmount: index === 0 ? 8 : 0,
      method: index % 2 === 0 ? PaymentMethod.Cash : PaymentMethod.Stripe,
    };
    const booking = await BookingModel.create({
      user: data.user,
      space: data.space,
      date: data.date,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      rentalUnit: data.rentalUnit,
      rentalMode: data.rentalMode,
      workstationQuantity: data.workstationQuantity,
      status: 'confirmed',
    });
    await createPaymentForBooking(booking, data);
    coworkingBookings.push(booking);
  }

  await WalletMovementModel.create([
    ...managers.map((manager) => ({
      user: manager._id,
      type: 'credit',
      reason: 'signup_bonus',
      amount: 35,
      currency: 'EUR',
      description: 'Credito iniziale demo gestore',
    })),
    ...clients.map((client) => ({
      user: client._id,
      type: 'credit',
      reason: 'signup_bonus',
      amount: 20,
      currency: 'EUR',
      description: 'Credito iniziale demo cliente',
    })),
  ]);

  const courses: any[] = [];
  for (let index = 0; index < normalBookingDocs.length; index += 1) {
    const booking = normalBookingDocs[index];
    const catalog = courseCatalog[index % courseCatalog.length];
    const image = imagePairs[index % imagePairs.length];
    const isFree = index % 7 === 0;
    const price = isFree ? 0 : 18 + (index % 5) * 6;
    const capacity = 8 + (index % 7) * 2;
    const title = `${catalog[0]} ${index + 1}`;
    const course = await CourseModel.create({
      title,
      description: `Un appuntamento curato per vivere N'Agora con una proposta concreta, accessibile e ben organizzata. ${title} unisce qualita, relazione e attenzione agli spazi.`,
      tags: catalog[1],
      imageUrl: image.card,
      bannerImageUrl: image.banner,
      cardImageUrl: image.card,
      imageCrop: { x: 0, y: 0, scale: 1 },
      bannerImageCrop: { x: 0, y: 0, scale: 1 },
      cardImageCrop: { x: 0, y: 0, scale: 1 },
      date: booking.date,
      startTime: addMinutes(booking.startTime, 15),
      endTime: addMinutes(booking.startTime, 75),
      booking: booking._id,
      capacity,
      enrollmentType: isFree ? 'free' : 'paid',
      price,
      isPublished: true,
      approvalStatus: CourseApprovalStatus.Approved,
      approvedAt: new Date(),
      approvedBy: index % 2 === 0 ? valente._id : adminDemo._id,
      participants: [],
    });
    courses.push(course);
  }

  for (let index = 0; index < courses.length; index += 1) {
    const course = courses[index];
    const subscriberCount = 3 + (index % 4);
    const selectedClients = Array.from({ length: subscriberCount }, (_, offset) => clients[(index + offset) % clients.length]);
    const participantIds: Types.ObjectId[] = [];

    for (let offset = 0; offset < selectedClients.length; offset += 1) {
      const client = selectedClients[offset];
      const totalAmount = Number(course.price || 0);
      const walletAmount = totalAmount > 0 && offset === 0 ? Math.min(10, totalAmount) : 0;
      const externalAmount = Math.max(totalAmount - walletAmount, 0);
      const paymentMethod = totalAmount === 0
        ? undefined
        : offset % 3 === 0
          ? PaymentMethod.Cash
          : offset % 3 === 1
            ? PaymentMethod.Stripe
            : PaymentMethod.Paypal;

      const courseBooking = await CourseBookingModel.create({
        user: client._id,
        course: course._id,
        status: 'confirmed',
        enrollmentType: totalAmount > 0 ? 'paid' : 'free',
        amount: externalAmount,
        totalAmount,
        walletAmount,
        externalAmount,
        originalAmount: totalAmount,
        discountAmount: 0,
        paymentMethod,
        paymentStatus: totalAmount > 0 ? 'PAID' : 'FREE',
      });

      if (walletAmount > 0) {
        await WalletMovementModel.create({
          user: client._id,
          courseBooking: courseBooking._id,
          type: 'debit',
          reason: 'course_payment',
          amount: walletAmount,
          currency: 'EUR',
          description: `Utilizzo wallet su ${course.title}`,
        });
      }
      participantIds.push(objectId(client._id));
    }

    await CourseModel.updateOne({ _id: course._id }, { $set: { participants: participantIds } }).exec();
  }

  await DiscountCodeModel.create([
    {
      code: 'AGORA10',
      title: 'Benvenuto in N Agora',
      description: 'Sconto demo del 10% per nuovi clienti.',
      isAutomatic: false,
      type: 'percentage',
      value: 10,
      target: 'all',
      spaces: [],
      userRoles: [UserRole.Cliente],
      rule: 'new_user',
      newUserDays: 30,
      isActive: true,
      validFrom: makeDate(8, 1),
      validTo: makeDate(9, 30),
      usedCount: 0,
    },
    {
      code: 'AREA15',
      title: 'Promo stanze ad aree',
      description: 'Sconto demo sui corsi creati nelle stanze divisibili.',
      isAutomatic: false,
      type: 'fixed',
      value: 15,
      target: 'course',
      spaces: [salaChiaia._id, salaSanita._id],
      userRoles: [UserRole.Cliente],
      rule: 'manual',
      isActive: true,
      validFrom: makeDate(8, 1),
      validTo: makeDate(9, 30),
      usedCount: 0,
    },
  ]);

  await NotificationModel.create([
    {
      audience: 'admin',
      title: 'Database demo rigenerato',
      message: `Create ${normalBookingDocs.length} prenotazioni stanza, ${coworkingBookings.length} prenotazioni coworking e ${courses.length} corsi.`,
      type: 'demo_seed',
      link: '/dashboard',
    },
    {
      audience: 'admin',
      title: 'Nuove prenotazioni stanze',
      message: `${managerElena.name} e ${managerDario.name} hanno acquistato stanze tra agosto e settembre.`,
      type: 'booking_created',
      link: '/bookings?month=8&year=2026',
    },
    {
      audience: 'gestore',
      user: managerElena._id,
      title: 'Corsi approvati',
      message: `I corsi demo di ${managerElena.name} sono stati approvati dall amministrazione.`,
      type: 'course_approved',
      link: '/courses',
    },
    {
      audience: 'gestore',
      user: managerDario._id,
      title: 'Iscrizioni ricevute',
      message: `I corsi demo di ${managerDario.name} hanno ricevuto nuove iscrizioni clienti.`,
      type: 'course_booking_created',
      link: '/courses',
    },
    {
      audience: 'cliente',
      user: clients[0]._id,
      title: 'Nuovi corsi per te',
      message: 'Abbiamo trovato corsi demo in linea con i tuoi interessi.',
      type: 'course_suggested',
      link: '/courses',
    },
  ]);

  const counts = {
    users: await UserModel.countDocuments().exec(),
    spaces: await SpaceModel.countDocuments().exec(),
    bookings: await BookingModel.countDocuments().exec(),
    courses: await CourseModel.countDocuments().exec(),
    courseBookings: await CourseBookingModel.countDocuments().exec(),
  };

  console.log('Database N Agora svuotato e ripopolato.');
  console.log(counts);
  console.log('');
  console.log('Credenziali demo principali');
  console.log(`Conservato: ${preservedEmail} / password invariata se esisteva, altrimenti ${demoPassword}`);
  console.log(`Admin:      admin@nagora.demo / ${demoPassword}`);
  console.log(`Gestore:    elena.sannino@nagora.demo / ${demoPassword}`);
  console.log(`Gestore:    dario.ferrara@nagora.demo / ${demoPassword}`);
  console.log(`Cliente:    giulia.verdi@nagora.demo / ${demoPassword}`);
  console.log(`Cliente:    andrea.neri@nagora.demo / ${demoPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
