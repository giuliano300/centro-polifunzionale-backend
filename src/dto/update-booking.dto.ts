export class UpdateBookingDto {
  status?: 'pending' | 'confirmed' | 'cancellation_requested' | 'cancelled';
  name?: string;
  startTime?: string;
  endTime?: string;
}
