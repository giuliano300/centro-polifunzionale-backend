import { BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';

const baseSpace = {
  _id: '64b000000000000000000001',
  name: 'Sala divisibile',
  isAvailable: true,
  rentalUnit: 'whole_room',
  rentalModes: ['time'],
  hourlyRate: 100,
  dailyRate: 300,
  timeSlotMinutes: 60,
  maxConsecutiveTimeSlots: 4,
  sectorEnabled: true,
  sectorCount: 2,
  sectorNames: ['Lato finestra', 'Lato ingresso'],
  sectorRate: 60,
  sectorDailyRate: 180,
  openingHours: [
    { day: 1, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 4 },
  ],
  exceptionalClosures: [],
};

function serviceWithBookings(bookings: unknown[]): BookingService {
  const bookingModel = {
    find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(bookings) }),
  };

  return new BookingService(
    bookingModel as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { bookingHoldMinutes: jest.fn().mockResolvedValue(15) } as never,
  );
}

describe('BookingService aree stanza', () => {
  it('permette due prenotazioni su aree diversi fino alla capienza', async () => {
    const service = serviceWithBookings([
      { rentalUnit: 'whole_room', sectorQuantity: 1, sectorIndexes: [0], startTime: '10:00', endTime: '11:00' },
    ]);

    await expect((service as never as { validateBookingConflicts: Function }).validateBookingConflicts(baseSpace, {
      spaceId: baseSpace._id,
      date: '2026-07-27',
      name: 'Secondo area',
      startTime: '10:00',
      endTime: '11:00',
      rentalUnit: 'whole_room',
      rentalMode: 'time',
      sectorQuantity: 1,
      sectorIndexes: [1],
    })).resolves.toBeUndefined();
  });

  it('blocca lo stesso area se e gia venduto nello stesso orario', async () => {
    const service = serviceWithBookings([
      { rentalUnit: 'whole_room', sectorQuantity: 1, sectorIndexes: [0], startTime: '10:00', endTime: '11:00' },
    ]);

    await expect((service as never as { validateBookingConflicts: Function }).validateBookingConflicts(baseSpace, {
      spaceId: baseSpace._id,
      date: '2026-07-27',
      name: 'Stesso area',
      startTime: '10:00',
      endTime: '11:00',
      rentalUnit: 'whole_room',
      rentalMode: 'time',
      sectorQuantity: 1,
      sectorIndexes: [0],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocca la stanza intera se un area e gia venduta nello stesso orario', async () => {
    const service = serviceWithBookings([
      { rentalUnit: 'whole_room', sectorQuantity: 1, sectorIndexes: [0], startTime: '10:00', endTime: '11:00' },
    ]);

    await expect((service as never as { validateBookingConflicts: Function }).validateBookingConflicts(baseSpace, {
      spaceId: baseSpace._id,
      date: '2026-07-27',
      name: 'Stanza intera',
      startTime: '10:00',
      endTime: '11:00',
      rentalUnit: 'whole_room',
      rentalMode: 'time',
      sectorQuantity: 2,
      sectorIndexes: [0, 1],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calcola il prezzo dei aree e il prezzo intero quando selezionati tutti', () => {
    const service = serviceWithBookings([]);
    const amountForHalf = (service as never as { calculateAmount: Function }).calculateAmount(baseSpace, {
      date: '2026-07-27',
      startTime: '10:00',
      endTime: '12:00',
      rentalUnit: 'whole_room',
      rentalMode: 'time',
      sectorQuantity: 1,
    });
    const amountForWhole = (service as never as { calculateAmount: Function }).calculateAmount(baseSpace, {
      date: '2026-07-27',
      startTime: '10:00',
      endTime: '12:00',
      rentalUnit: 'whole_room',
      rentalMode: 'time',
      sectorQuantity: 2,
    });

    expect(amountForHalf).toBe(120);
    expect(amountForWhole).toBe(200);
  });
});
