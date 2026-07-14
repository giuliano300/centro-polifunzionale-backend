import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from 'src/schemas/booking.schema';
import { Course, CourseDocument } from 'src/schemas/course.schema';
import { CourseBooking } from 'src/schemas/course-booking.schema';
import { Payment, PaymentDocument } from 'src/schemas/payment.schema';
import { Space, SpaceDocument } from 'src/schemas/space.schema';
import { User, UserDocument } from 'src/schemas/user.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Space.name) private spaceModel: Model<SpaceDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(CourseBooking.name) private courseBookingModel: Model<CourseBooking>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
  ) {}

  async getStats() {
    const now = new Date();
    const todayStart = this.startOfDay(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const last30DaysStart = new Date(todayStart);
    last30DaysStart.setDate(last30DaysStart.getDate() - 30);

    const [
      totalUsers,
      totalClients,
      totalManagers,
      activeUsers,
      totalSpaces,
      availableSpaces,
      totalBookings,
      todayBookings,
      monthBookings,
      totalCourses,
      publishedCourses,
      monthCourses,
      totalCourseBookings,
      pendingCourseBookings,
      paidRevenue,
      monthRevenue,
      pendingPayments,
      recentUsers,
      recentBookings,
      recentCourses,
      recentCourseBookings,
      upcomingBookings,
      upcomingCourses,
      spaceUsage,
      bookingStatusBreakdown,
      paymentStatusBreakdown,
      courseBookingStatusBreakdown,
    ] = await Promise.all([
      this.userModel.countDocuments({ role: { $ne: 'admin' } }).exec(),
      this.userModel.countDocuments({ role: 'cliente' }).exec(),
      this.userModel.countDocuments({ role: 'gestore' }).exec(),
      this.userModel.countDocuments({ role: { $ne: 'admin' }, isActive: { $ne: false } }).exec(),
      this.spaceModel.countDocuments().exec(),
      this.spaceModel.countDocuments({ isAvailable: true }).exec(),
      this.bookingModel.countDocuments().exec(),
      this.bookingModel.countDocuments({ date: { $gte: todayStart, $lt: tomorrowStart } }).exec(),
      this.bookingModel.countDocuments({ date: { $gte: monthStart, $lt: nextMonthStart } }).exec(),
      this.courseModel.countDocuments().exec(),
      this.courseModel.countDocuments({ isPublished: true }).exec(),
      this.courseModel.countDocuments({ date: { $gte: monthStart, $lt: nextMonthStart } }).exec(),
      this.courseBookingModel.countDocuments({ status: { $ne: 'cancelled' } }).exec(),
      this.courseBookingModel.countDocuments({ status: 'pending' }).exec(),
      this.sumPayments({ status: 'PAID' }),
      this.sumPayments({ status: 'PAID', createdAt: { $gte: monthStart, $lt: nextMonthStart } }),
      this.sumPayments({ status: 'PENDING' }),
      this.userModel.find({ role: { $ne: 'admin' } }).sort({ _id: -1 }).limit(6).select('-password').exec(),
      this.bookingModel.find().sort({ _id: -1 }).limit(6).populate('user').populate('space').exec(),
      this.courseModel.find().sort({ _id: -1 }).limit(6).populate({
        path: 'booking',
        populate: [{ path: 'user' }, { path: 'space' }],
      }).exec(),
      this.courseBookingModel.find().sort({ _id: -1 }).limit(6).populate('user').populate({
        path: 'course',
        populate: {
          path: 'booking',
          populate: [{ path: 'space' }, { path: 'user' }],
        },
      }).exec(),
      this.bookingModel.find({ date: { $gte: todayStart } }).sort({ date: 1, startTime: 1 }).limit(8).populate('user').populate('space').exec(),
      this.courseModel.find({ date: { $gte: todayStart }, isPublished: true }).sort({ date: 1, startTime: 1 }).limit(8).populate({
        path: 'booking',
        populate: [{ path: 'user' }, { path: 'space' }],
      }).exec(),
      this.bookingModel.aggregate([
        { $match: { date: { $gte: last30DaysStart } } },
        { $group: { _id: '$space', bookings: { $sum: 1 } } },
        { $sort: { bookings: -1 } },
        { $limit: 6 },
        { $lookup: { from: 'spaces', localField: '_id', foreignField: '_id', as: 'space' } },
        { $unwind: '$space' },
        { $project: { _id: 0, spaceId: '$_id', name: '$space.name', bookings: 1 } },
      ]).exec(),
      this.bookingModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]).exec(),
      this.paymentModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
        { $project: { _id: 0, status: '$_id', count: 1, amount: 1 } },
      ]).exec(),
      this.courseBookingModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]).exec(),
    ]);

    return {
      generatedAt: now,
      totals: {
        users: totalUsers,
        clients: totalClients,
        managers: totalManagers,
        activeUsers,
        spaces: totalSpaces,
        availableSpaces,
        bookings: totalBookings,
        courses: totalCourses,
        publishedCourses,
        courseBookings: totalCourseBookings,
      },
      period: {
        todayBookings,
        monthBookings,
        monthCourses,
        pendingCourseBookings,
        paidRevenue,
        monthRevenue,
        pendingPayments,
      },
      breakdowns: {
        bookingsByStatus: bookingStatusBreakdown,
        paymentsByStatus: paymentStatusBreakdown,
        courseBookingsByStatus: courseBookingStatusBreakdown,
        spaceUsage,
      },
      recent: {
        users: recentUsers,
        bookings: recentBookings,
        courses: recentCourses,
        courseBookings: recentCourseBookings,
      },
      upcoming: {
        bookings: upcomingBookings,
        courses: upcomingCourses,
      },
    };
  }

  private startOfDay(date: Date): Date {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  private async sumPayments(match: Record<string, unknown>): Promise<number> {
    const result = await this.paymentModel.aggregate([
      { $match: match },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]).exec();

    return result[0]?.amount || 0;
  }
}
