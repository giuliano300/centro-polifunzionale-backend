import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { CourseService } from "../../services/course.service";
import { CreateCourseDto } from "../../dto/create-course.dto";
import { UpdateCourseDto } from "../../dto/update-course.dto";
import { AuthGuard } from "@nestjs/passport";
import { Roles, UserRole } from "src/roles/roles.decorator";
import { RolesGuard } from "src/roles/roles.guard";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller('courses')
export class CoursesController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  create(@Body() dto: CreateCourseDto, @Req() req) {
    return this.courseService.create(dto, req.user.role === UserRole.Gestore ? req.user.userId : undefined);
  }

  @Post('upload-image')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  @UseInterceptors(FileInterceptor('image'))
  uploadImage(@UploadedFile() file: any, @Query('type') type?: 'banner' | 'card') {
    return this.courseService.saveCourseImage(file, type === 'card' ? 'card' : 'banner');
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  findAll(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('scope') scope?: string,
    @Query('managerId') managerId?: string,
    @Req() req?,
  ) {
    return this.courseService.findAll({
      start,
      end,
      status,
      search,
      managerId: req.user.role === UserRole.Gestore && scope === 'manager'
        ? req.user.userId
        : req.user.role === UserRole.Admin ? managerId : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.courseService.findOne(id);
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  approve(@Param('id') id: string, @Req() req) {
    return this.courseService.approve(id, req.user.userId);
  }

  @Patch(':id/close')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  close(@Param('id') id: string) {
    return this.courseService.close(id);
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  reject(@Param('id') id: string) {
    return this.courseService.reject(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto, @Req() req) {
    return this.courseService.update(id, dto, req.user.role === UserRole.Gestore ? req.user.userId : undefined);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  remove(@Param('id') id: string, @Req() req) {
    return this.courseService.remove(id, req.user.role === UserRole.Gestore ? req.user.userId : undefined);
  }
}
