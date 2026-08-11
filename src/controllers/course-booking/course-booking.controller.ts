import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles, UserRole } from "../../roles/roles.decorator";
import { RolesGuard } from "../../roles/roles.guard";
import { AuthGuard } from "@nestjs/passport";
import { CreateCourseBookingDto } from "src/dto/create-course-booking.dto";
import { UpdateCourseBookingPaymentMethodDto } from "src/dto/update-course-booking-payment-method.dto";
import { CourseBookingsService } from "src/services/course-booking.service";
import { FilterCourseBookingDto } from "src/filters/filter-course-booking.dto";

@Controller('course-bookings')
export class CourseBookingsController {
  constructor(private readonly courseBookingsService: CourseBookingsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async create(@Body() dto: CreateCourseBookingDto, @Req() req, @Headers('idempotency-key') idempotencyKey?: string) {
    const targetDto = {
      ...dto,
      userId: req.user.role === UserRole.Cliente ? req.user.userId : dto.userId,
    };
    return this.courseBookingsService.create(targetDto, req.user.userId, idempotencyKey);
  }


  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async findAll(@Query() filterDto: FilterCourseBookingDto, @Req() req) {
    const scope = filterDto.scope;
    const targetFilter = scope === 'mine' || req.user.role === UserRole.Cliente
      ? { ...filterDto, userId: req.user.userId }
      : req.user.role === UserRole.Gestore
        ? { ...filterDto, managerId: req.user.userId }
        : filterDto;
    return this.courseBookingsService.findAll(targetFilter);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async remove(@Param('id') id: string, @Req() req) {
    return this.courseBookingsService.remove(id, req.user.role === UserRole.Cliente ? req.user.userId : undefined);
  }

  @Patch(':id/payment-method')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async updatePaymentMethod(@Param('id') id: string, @Body() dto: UpdateCourseBookingPaymentMethodDto, @Req() req) {
    return this.courseBookingsService.updatePaymentMethod(id, dto.paymentMethod, req.user.role === UserRole.Cliente ? req.user.userId : undefined);
  }

}
