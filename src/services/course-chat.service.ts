import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CourseChatMessage } from 'src/schemas/course-chat-message.schema';
import { Course, CourseDocument } from 'src/schemas/course.schema';
import { CourseBooking } from 'src/schemas/course-booking.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from 'src/controllers/notifications/notifications.gateway';
import { UserRole } from 'src/roles/user-role.enum';
import { CourseChatRoom } from 'src/schemas/course-chat-room.schema';
import { CourseChatRead } from 'src/schemas/course-chat-read.schema';
import { CourseChatModerationEvent } from 'src/schemas/course-chat-moderation-event.schema';
import { User } from 'src/schemas/user.schema';

@Injectable()
export class CourseChatService {
  constructor(
    @InjectModel(CourseChatMessage.name) private messageModel: Model<CourseChatMessage>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(CourseBooking.name) private bookingModel: Model<CourseBooking>,
    @InjectModel(CourseChatRoom.name) private roomModel: Model<CourseChatRoom>,
    @InjectModel(CourseChatRead.name) private readModel: Model<CourseChatRead>,
    @InjectModel(CourseChatModerationEvent.name) private moderationModel: Model<CourseChatModerationEvent>,
    @InjectModel(User.name) private userModel: Model<User>,
    private notifications: NotificationsService,
    private gateway: NotificationsGateway,
  ) {}

  async rooms(courseId: string, userId: string, role: UserRole) {
    const course = await this.assertMember(courseId, userId, role);
    await this.ensureGeneralRoom(courseId, course.managerId);
    const query: any = { course: new Types.ObjectId(courseId) };
    if (role !== UserRole.Admin && userId !== course.managerId) query.members = new Types.ObjectId(userId);
    const rooms = await this.roomModel.find(query).sort({ isGeneral: -1, createdAt: 1 }).populate('members', 'name email role').lean().exec() as any[];
    const decorated = await Promise.all(rooms.map(async (room) => {
      const read = await this.readModel.findOne({ room: room._id, user: new Types.ObjectId(userId) }).lean().exec() as any;
      const unreadCount = await this.messageModel.countDocuments({ room: room._id, sender: { $ne: new Types.ObjectId(userId) }, createdAt: { $gt: read?.lastReadAt || new Date(0) } }).exec();
      return { ...room, unreadCount, lastReadAt: read?.lastReadAt || null };
    }));
    return decorated.map((room) => {
      if (!room.directKey || userId === course.managerId) return room;
      const manager = room.members?.find((member: any) => String(member?._id || member) === course.managerId);
      return { ...room, title: manager?.name || manager?.email || 'Gestore' };
    });
  }

  async createRoom(courseId: string, userId: string, role: UserRole, body: { title: string; memberIds: string[]; isGroup?: boolean }) {
    const course = await this.assertMember(courseId, userId, role);
    if (role !== UserRole.Admin && userId !== course.managerId) {
      return this.directRoom(courseId, course.managerId, userId, userId);
    }
    const requested = [...new Set((body.memberIds || []).filter(Types.ObjectId.isValid))];
    const enrolled = await this.bookingModel.find({ course: new Types.ObjectId(courseId), user: { $in: requested.map((id) => new Types.ObjectId(id)) }, status: 'confirmed' }).select('user').lean().exec();
    if (body.isGroup && enrolled.length < 2) throw new ForbiddenException('Per un gruppo seleziona almeno due iscritti confermati');
    if (enrolled.length === 1) {
      return this.directRoom(courseId, course.managerId, enrolled[0].user.toString(), userId);
    }
    const members = [...new Set([course.managerId, ...enrolled.map((item) => item.user.toString())])];
    if (members.length < 3) throw new ForbiddenException('Per un gruppo seleziona almeno due iscritti confermati');
    return this.roomModel.create({ course: new Types.ObjectId(courseId), title: String(body.title || '').trim() || 'Nuovo gruppo', createdBy: new Types.ObjectId(userId), members: members.map((id) => new Types.ObjectId(id)) });
  }

  private async directRoom(courseId: string, managerId: string, clientId: string, createdBy: string): Promise<any> {
    const memberIds = [managerId, clientId].sort();
    const directKey = `${courseId}:${memberIds.join(':')}`;
    const legacy = await this.roomModel.findOne({
      course: new Types.ObjectId(courseId), isGeneral: false,
      members: { $all: memberIds.map((id) => new Types.ObjectId(id)), $size: 2 },
    }).sort({ createdAt: 1 }).exec();
    if (legacy) {
      if (!legacy.directKey) { legacy.directKey = directKey; await legacy.save(); }
      return legacy;
    }
    const booking = await this.bookingModel.findOne({ course: new Types.ObjectId(courseId), user: new Types.ObjectId(clientId), status: 'confirmed' }).populate('user', 'name email').lean().exec() as any;
    const clientName = booking?.user?.name || booking?.user?.email || 'cliente';
    return this.roomModel.findOneAndUpdate(
      { directKey },
      { $setOnInsert: { course: new Types.ObjectId(courseId), title: `Chat con ${clientName}`, createdBy: new Types.ObjectId(createdBy), members: memberIds.map((id) => new Types.ObjectId(id)), isGeneral: false, directKey } },
      { upsert: true, new: true },
    ).exec();
  }

  async findAll(courseId: string, userId: string, role: UserRole, roomId?: string) {
    const room = roomId ? await this.assertRoom(courseId, roomId, userId, role) : await this.defaultRoom(courseId, userId, role);
    const messages = await this.messageModel.find({ room: room._id }).sort({ createdAt: 1 }).limit(300).populate('sender', 'name role').exec();
    const latestMessage = messages[messages.length - 1] as any;
    if (latestMessage?.createdAt) await this.setRead(room._id.toString(), userId, latestMessage.createdAt);
    return messages;
  }

  async markRead(courseId: string, roomId: string, userId: string, role: UserRole) {
    await this.assertRoom(courseId, roomId, userId, role);
    const latestMessage = await this.messageModel.findOne({ room: new Types.ObjectId(roomId) }).sort({ createdAt: -1 }).select('createdAt').lean().exec() as any;
    if (latestMessage?.createdAt) await this.setRead(roomId, userId, latestMessage.createdAt);
    return { read: true };
  }

  private async setRead(roomId: string, userId: string, lastReadAt: Date): Promise<void> {
    await this.readModel.findOneAndUpdate(
      { room: new Types.ObjectId(roomId), user: new Types.ObjectId(userId) },
      { $max: { lastReadAt } }, { upsert: true, new: true },
    ).exec();
  }

  async send(courseId: string, userId: string, role: UserRole, text: string, roomId?: string, moderationConfirmed = false) {
    const course = await this.assertMember(courseId, userId, role);
    const room = roomId ? await this.assertRoom(courseId, roomId, userId, role) : await this.defaultRoom(courseId, userId, role);
    await this.moderateMessage(courseId, room._id.toString(), userId, text, moderationConfirmed);
    const saved = await this.messageModel.create({ course: new Types.ObjectId(courseId), room: room._id, sender: new Types.ObjectId(userId), text: text.trim() });
    const message = await this.messageModel.findById(saved._id).populate('sender', 'name role').lean().exec();
    const recipients = room.members.map((id: any) => id._id?.toString?.() || id.toString());
    this.gateway.emitChatMessage(recipients, message);
    void Promise.all(recipients.filter((id) => id !== userId).map((id) => this.notifications.sendPushNotification(id, {
      title: `${room.title}: ${course.title}`, message: text.trim(),
      link: `/course-chat/${courseId}?roomId=${room._id}`,
    })));
    return message;
  }

  private async moderateMessage(courseId: string, roomId: string, userId: string, text: string, confirmed: boolean): Promise<void> {
    const now = new Date();
    const suspension = await this.moderationModel.findOne({ user: new Types.ObjectId(userId), action: 'suspended', mutedUntil: { $gt: now } }).sort({ createdAt: -1 }).lean().exec() as any;
    if (suspension?.mutedUntil) {
      throw new ForbiddenException({ code: 'CHAT_SUSPENDED', message: `Chat sospesa fino al ${new Date(suspension.mutedUntil).toLocaleString('it-IT')}.` });
    }

    const result = this.analyzeMessage(text);
    if (!result) return;
    const base = { user: new Types.ObjectId(userId), course: new Types.ObjectId(courseId), room: new Types.ObjectId(roomId), category: result.category, severity: result.severity };

    if (result.severity >= 2) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const previous = await this.moderationModel.countDocuments({ user: new Types.ObjectId(userId), severity: { $gte: 2 }, action: { $in: ['blocked', 'suspended'] }, createdAt: { $gte: since } }).exec();
      const mutedUntil = previous >= 2 ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined;
      await this.moderationModel.create({ ...base, action: mutedUntil ? 'suspended' : 'blocked', messageText: text.trim(), mutedUntil });
      const author = await this.userModel.findById(userId).select('name email role').lean().exec() as any;
      const authorLabel = author?.name || author?.email || userId;
      await this.notifications.create({
        audience: 'admin', title: mutedUntil ? 'Utente sospeso dalla chat' : 'Messaggio chat bloccato',
        message: `${authorLabel} (${author?.role || 'utente'}): “${text.trim()}” — categoria ${result.category}, gravità ${result.severity}.`,
        type: 'course_chat_moderation', link: `/users?userId=${userId}&moderation=1`,
      });
      throw new ForbiddenException({ code: mutedUntil ? 'CHAT_SUSPENDED' : 'MESSAGE_BLOCKED', message: mutedUntil ? 'Messaggio bloccato. La chat è stata sospesa per 24 ore a causa di violazioni ripetute.' : result.message });
    }

    if (!confirmed) {
      await this.moderationModel.create({ ...base, action: 'warning' });
      throw new UnprocessableEntityException({ code: 'MODERATION_CONFIRM_REQUIRED', message: result.message, terms: result.terms });
    }
    await this.moderationModel.create({ ...base, action: 'allowed_after_warning', messageText: text.trim() });
    const repeatedLanguage = await this.moderationModel.countDocuments({
      user: new Types.ObjectId(userId), category: 'language', createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).exec();
    if (repeatedLanguage >= 3) {
      const author = await this.userModel.findById(userId).select('name email role').lean().exec() as any;
      const authorLabel = author?.name || author?.email || userId;
      await this.notifications.create({
        audience: 'admin', title: 'Linguaggio inappropriato ripetuto',
        message: `${authorLabel} (${author?.role || 'utente'}) ha ignorato ripetutamente gli avvisi. Ultimo messaggio: “${text.trim()}”.`,
        type: 'course_chat_moderation', link: `/users?userId=${userId}&moderation=1`,
      });
    }
  }

  private analyzeMessage(value: string): { category: 'language' | 'insult' | 'threat' | 'discrimination'; severity: number; message: string; terms: string[] } | null {
    const normalized = value.toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9àèéìòù\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    const words = (list: string[]) => list.filter((term) => new RegExp(`(^|\\s)${term.replace(/ /g, '\\s+')}($|\\s)`, 'i').test(normalized));
    const threats = words(['ti ammazzo', 'ti uccido', 'vi ammazzo', 'vi uccido', 'devi morire', 'muori', 'ti spacco']);
    if (threats.length) return { category: 'threat', severity: 3, message: 'Il messaggio contiene una minaccia e non può essere inviato.', terms: threats };
    const discrimination = words(['negro', 'frocio', 'zingaro di merda']);
    if (discrimination.length) return { category: 'discrimination', severity: 3, message: 'Il messaggio contiene linguaggio discriminatorio e non può essere inviato.', terms: discrimination };
    const insults = words(['sei un idiota', 'sei una idiota', 'sei un imbecille', 'testa di cazzo', 'pezzo di merda', 'stronzo', 'stronza']);
    if (insults.length) return { category: 'insult', severity: 2, message: 'Il messaggio contiene un insulto diretto e non può essere inviato.', terms: insults };
    const language = words(['culo', 'cazzo', 'merda', 'vaffanculo']);
    if (language.length) return { category: 'language', severity: 1, message: 'Il messaggio contiene linguaggio potenzialmente inappropriato. Vuoi inviarlo comunque?', terms: language };
    return null;
  }

  private async defaultRoom(courseId: string, userId: string, role: UserRole): Promise<any> {
    const course = await this.assertMember(courseId, userId, role);
    const room = await this.ensureGeneralRoom(courseId, course.managerId);
    await this.assertRoom(courseId, room._id.toString(), userId, role);
    return room;
  }

  private async ensureGeneralRoom(courseId: string, managerId: string): Promise<any> {
    const members = await this.memberIds(courseId, { managerId });
    return this.roomModel.findOneAndUpdate(
      { course: new Types.ObjectId(courseId), isGeneral: true },
      { $set: { title: 'Chat generale', members: members.map((id) => new Types.ObjectId(id)) }, $setOnInsert: { createdBy: new Types.ObjectId(managerId), isGeneral: true } },
      { upsert: true, new: true },
    ).exec();
  }

  private async assertRoom(courseId: string, roomId: string, userId: string, role: UserRole): Promise<any> {
    const room = await this.roomModel.findOne({ _id: new Types.ObjectId(roomId), course: new Types.ObjectId(courseId) }).exec();
    if (!room) throw new NotFoundException('Conversazione non trovata');
    if (role !== UserRole.Admin && !room.members.some((id) => id.toString() === userId)) throw new ForbiddenException('Non fai parte di questa conversazione');
    return room;
  }

  private async assertMember(courseId: string, userId: string, role: UserRole): Promise<{ title: string; managerId: string }> {
    const course = await this.courseModel.findById(courseId).populate({ path: 'booking', populate: { path: 'user' } }).exec() as any;
    if (!course) throw new NotFoundException('Corso non trovato');
    const managerId = course.booking?.user?._id?.toString() || course.booking?.user?.toString();
    if (role === UserRole.Admin || managerId === userId) return { title: course.title, managerId };
    const enrolled = await this.bookingModel.exists({ course: new Types.ObjectId(courseId), user: new Types.ObjectId(userId), status: 'confirmed' });
    if (!enrolled) throw new ForbiddenException('La chat è riservata al gestore e agli iscritti confermati');
    return { title: course.title, managerId };
  }

  private async memberIds(courseId: string, course: { managerId: string }): Promise<string[]> {
    const bookings = await this.bookingModel.find({ course: new Types.ObjectId(courseId), status: 'confirmed' }).select('user').lean().exec();
    return [...new Set([course.managerId, ...bookings.map((item) => item.user.toString())].filter(Boolean))];
  }
}
