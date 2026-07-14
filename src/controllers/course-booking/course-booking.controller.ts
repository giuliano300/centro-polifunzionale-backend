import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../roles/roles.decorator";
import { RolesGuard } from "../../roles/roles.guard";
import { AuthGuard } from "@nestjs/passport";
import { CreateCourseBookingDto } from "src/dto/create-course-booking.dto";
import { CourseBookingsService } from "src/services/course-booking.service";
import { FilterCourseBookingDto } from "src/filters/filter-course-booking.dto";

@Controller('course-bookings')
export class CourseBookingsController {
  constructor(private readonly courseBookingsService: CourseBookingsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async create(@Body() dto: CreateCourseBookingDto, @Req() req) {
    const targetDto = {
      ...dto,
      userId: req.user.role === 'cliente' ? req.user.userId : dto.userId,
    };
    return this.courseBookingsService.create(targetDto, req.user.userId);
  }


  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async findAll(@Query() filterDto: FilterCourseBookingDto, @Req() req) {
    const targetFilter = req.user.role === 'cliente'
      ? { ...filterDto, userId: req.user.userId }
      : filterDto;
    return this.courseBookingsService.findAll(targetFilter);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async remove(@Param('id') id: string, @Req() req) {
    return this.courseBookingsService.remove(id, req.user.role === 'cliente' ? req.user.userId : undefined);
  }

}
