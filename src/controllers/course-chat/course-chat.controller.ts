import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateCourseChatMessageDto } from 'src/dto/create-course-chat-message.dto';
import { CourseChatService } from 'src/services/course-chat.service';

@Controller('course-chat')
@UseGuards(AuthGuard('jwt'))
export class CourseChatController {
  constructor(private service: CourseChatService) {}
  @Get(':courseId') findAll(@Param('courseId') courseId: string, @Req() req) { return this.service.findAll(courseId, req.user.userId, req.user.role); }
  @Post(':courseId') send(@Param('courseId') courseId: string, @Req() req, @Body() dto: CreateCourseChatMessageDto) { return this.service.send(courseId, req.user.userId, req.user.role, dto.text, undefined, dto.moderationConfirmed); }
  @Get(':courseId/rooms') rooms(@Param('courseId') courseId: string, @Req() req) { return this.service.rooms(courseId, req.user.userId, req.user.role); }
  @Post(':courseId/rooms') createRoom(@Param('courseId') courseId: string, @Req() req, @Body() body: { title: string; memberIds: string[]; isGroup?: boolean }) { return this.service.createRoom(courseId, req.user.userId, req.user.role, body); }
  @Get(':courseId/rooms/:roomId/messages') roomMessages(@Param('courseId') courseId: string, @Param('roomId') roomId: string, @Req() req) { return this.service.findAll(courseId, req.user.userId, req.user.role, roomId); }
  @Post(':courseId/rooms/:roomId/messages') sendRoomMessage(@Param('courseId') courseId: string, @Param('roomId') roomId: string, @Req() req, @Body() dto: CreateCourseChatMessageDto) { return this.service.send(courseId, req.user.userId, req.user.role, dto.text, roomId, dto.moderationConfirmed); }
  @Patch(':courseId/rooms/:roomId/read') markRead(@Param('courseId') courseId: string, @Param('roomId') roomId: string, @Req() req) { return this.service.markRead(courseId, roomId, req.user.userId, req.user.role); }
}
