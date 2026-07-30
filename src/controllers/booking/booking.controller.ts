import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { CreateBookingDto } from "../../dto/create-booking.dto";
import { UpdateBookingDto } from "../../dto/update-booking.dto";
import { Roles, UserRole } from "../../roles/roles.decorator";
import { RolesGuard } from "../../roles/roles.guard";
import { BookingService } from "../../services/booking.service";
import { AuthGuard } from "@nestjs/passport";
import { FilterBookingsDto } from "src/filters/filter-bookings.dto";

type PopulatedUserRef = string | { _id?: { toString(): string }; toString(): string };

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async create(@Body() dto: CreateBookingDto, @Req() req) {
    const targetDto = {
      ...dto,
      userId: req.user.role === UserRole.Cliente ? req.user.userId : dto.userId,
    };
    return this.bookingsService.create(targetDto, req.user.userId);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async findAll(@Query() filterDto: FilterBookingsDto, @Req() req) {
    const targetFilter = req.user.role === UserRole.Cliente || req.user.role === UserRole.Gestore
      ? { ...filterDto, userId: req.user.userId }
      : filterDto;
    return this.bookingsService.findAll(targetFilter);
  }

  @Get('availability')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async availability(
    @Query('spaceId') spaceId: string,
    @Query('date') date: string,
    @Query('rentalMode') rentalMode?: string,
    @Query('workstationQuantity') workstationQuantity?: string,
    @Query('sectorQuantity') sectorQuantity?: string,
    @Query('sectorIndexes') sectorIndexes?: string,
  ) {
    const parsedSectorIndexes = sectorIndexes
      ? sectorIndexes.split(',').map((value) => Number(value)).filter((value) => Number.isInteger(value))
      : [];
    return this.bookingsService.availability(spaceId, date, rentalMode || 'time', Number(workstationQuantity || 1), Number(sectorQuantity || 0), parsedSectorIndexes);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async findOne(@Param('id') id: string, @Req() req) {
    const booking = await this.bookingsService.findOne(id);
    const bookingUser = booking.user as PopulatedUserRef;
    const bookingUserId = typeof bookingUser === 'string'
      ? bookingUser
      : bookingUser._id?.toString() || bookingUser.toString();
    if (req.user.role === UserRole.Cliente && bookingUserId !== req.user.userId) {
      throw new ForbiddenException('Prenotazione non accessibile');
    }

    return booking;
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  async update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.update(id, dto);
  }

  @Post(':id/cancellation-request')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async requestCancellation(@Param('id') id: string, @Req() req) {
    const booking = await this.bookingsService.findOne(id);
    const bookingUser = booking.user as PopulatedUserRef;
    const bookingUserId = typeof bookingUser === 'string'
      ? bookingUser
      : bookingUser._id?.toString() || bookingUser.toString();
    if (req.user.role !== UserRole.Admin && bookingUserId !== req.user.userId) {
      throw new ForbiddenException('Prenotazione non accessibile');
    }

    return this.bookingsService.requestCancellation(id);
  }

  @Post(':id/cancellation-approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  async approveCancellation(@Param('id') id: string, @Body() dto: { walletCreditAmount?: number }) {
    return this.bookingsService.approveCancellation(id, Number(dto.walletCreditAmount || 0));
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  async remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
