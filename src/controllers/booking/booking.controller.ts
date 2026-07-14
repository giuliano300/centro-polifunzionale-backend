import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { CreateBookingDto } from "../../dto/create-booking.dto";
import { UpdateBookingDto } from "../../dto/update-booking.dto";
import { Roles } from "../../roles/roles.decorator";
import { RolesGuard } from "../../roles/roles.guard";
import { BookingService } from "../../services/booking.service";
import { AuthGuard } from "@nestjs/passport";
import { FilterBookingsDto } from "src/filters/filter-bookings.dto";

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async create(@Body() dto: CreateBookingDto, @Req() req) {
    const targetDto = {
      ...dto,
      userId: req.user.role === 'cliente' ? req.user.userId : dto.userId,
    };
    return this.bookingsService.create(targetDto, req.user.userId);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async findAll(@Query() filterDto: FilterBookingsDto, @Req() req) {
    const targetFilter = req.user.role === 'cliente'
      ? { ...filterDto, userId: req.user.userId }
      : filterDto;
    return this.bookingsService.findAll(targetFilter);
  }

  @Get('availability')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async availability(
    @Query('spaceId') spaceId: string,
    @Query('date') date: string,
    @Query('rentalMode') rentalMode?: string,
    @Query('workstationQuantity') workstationQuantity?: string,
  ) {
    return this.bookingsService.availability(spaceId, date, rentalMode || 'time', Number(workstationQuantity || 1));
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async findOne(@Param('id') id: string, @Req() req) {
    const booking = await this.bookingsService.findOne(id);
    const bookingUserId = typeof booking.user === 'string' ? booking.user : (booking.user as any)?._id?.toString();
    if (req.user.role === 'cliente' && bookingUserId !== req.user.userId) {
      throw new ForbiddenException('Prenotazione non accessibile');
    }

    return booking;
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
