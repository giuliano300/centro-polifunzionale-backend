import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateCourseTagDto, UpdateCourseTagDto } from 'src/dto/course-tag.dto';
import { Roles, UserRole } from 'src/roles/roles.decorator';
import { RolesGuard } from 'src/roles/roles.guard';
import { CourseTagService } from 'src/services/course-tag.service';

@Controller('course-tags')
export class CourseTagsController {
  constructor(private readonly courseTagService: CourseTagService) {}

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.courseTagService.findAll(includeInactive === 'true');
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  create(@Body() dto: CreateCourseTagDto) {
    return this.courseTagService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  update(@Param('id') id: string, @Body() dto: UpdateCourseTagDto) {
    return this.courseTagService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  remove(@Param('id') id: string) {
    return this.courseTagService.remove(id);
  }
}
