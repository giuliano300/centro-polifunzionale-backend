export class UpdateBookingDto {
  status?: 'pending' | 'confirmed' | 'cancelled';
  name?: string;
  startTime?: string;
  endTime?: string;
}