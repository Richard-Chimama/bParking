import { Resolver, Mutation, Query, Arg, Ctx, UseMiddleware, ID } from 'type-graphql';
import { AppDataSource } from '../../database/connection';
import { Waitlist, WaitlistStatus } from '../../entities/Waitlist';
import { User } from '../../entities/User';
import { Parking } from '../../entities/Parking';
import { Booking, BookingStatus, PaymentStatus } from '../../entities/Booking';
import { AuthMiddleware } from '@/middleware/graphqlAuth';
import { Context } from '@/type';
import NotificationService from '../../services/notification';
import WebSocketService from '../../services/websocket';
import { MoreThan, LessThan, In } from 'typeorm';
import { WaitlistType } from '../types/shared';

@Resolver()
export class WaitlistResolver {
  private notificationService: NotificationService;
  private webSocketService?: WebSocketService;

  constructor() {
    this.notificationService = new NotificationService();
    // WebSocket service will be injected when available
  }

  setWebSocketService(webSocketService: WebSocketService): void {
    this.webSocketService = webSocketService;
  }

  @Mutation(() => WaitlistType)
  @UseMiddleware(AuthMiddleware)
  async joinWaitlist(
    @Arg('parkingId', () => ID) parkingId: string,
    @Arg('desiredStartTime') desiredStartTime: Date,
    @Arg('desiredEndTime') desiredEndTime: Date,
    @Ctx() context: Context,
    @Arg('requiredSpaces', { defaultValue: 1 }) requiredSpaces: number,
    @Arg('vehicleInfo', { nullable: true }) vehicleInfo?: string,
    @Arg('specialRequests', { nullable: true }) specialRequests?: string
  ): Promise<Waitlist> {
    if (!context.user) {
      throw new Error('Authentication required');
    }
    
    const waitlistRepository = AppDataSource.getRepository(Waitlist);
    const parkingRepository = AppDataSource.getRepository(Parking);
    const userRepository = AppDataSource.getRepository(User);

    // Validate parking exists
    const parking = await parkingRepository.findOne({ where: { id: parkingId } });
    if (!parking) {
      throw new Error('Parking not found');
    }

    // Validate user exists
    const user = await userRepository.findOne({ where: { id: context.user.id } });
    if (!user) {
      throw new Error('User not found');
    }

    // Validate time range
    if (desiredStartTime >= desiredEndTime) {
      throw new Error('Start time must be before end time');
    }

    if (desiredStartTime <= new Date()) {
      throw new Error('Start time must be in the future');
    }

    // Check if user already has an active waitlist entry for this parking and time
    const existingWaitlist = await waitlistRepository.findOne({
      where: {
        userId: context.user.id,
        parkingId,
        status: In([WaitlistStatus.ACTIVE, WaitlistStatus.NOTIFIED]),
        desiredStartTime: LessThan(desiredEndTime),
        desiredEndTime: MoreThan(desiredStartTime)
      }
    });

    if (existingWaitlist) {
      throw new Error('You already have an active waitlist entry for this time slot');
    }

    // Check if parking is actually unavailable
    const bookingRepository = AppDataSource.getRepository(Booking);
    const conflictingBookings = await bookingRepository.count({
      where: {
        parkingId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
        startTime: LessThan(desiredEndTime),
        endTime: MoreThan(desiredStartTime)
      }
    });

    const availableSpaces = parking.totalSpaces - conflictingBookings;
    if (availableSpaces >= requiredSpaces) {
      throw new Error('Parking is currently available. Please book directly.');
    }

    // Get current position in waitlist
    const currentWaitlistCount = await waitlistRepository.count({
      where: {
        parkingId,
        status: WaitlistStatus.ACTIVE
      }
    });

    // Create waitlist entry
    const waitlist = new Waitlist();
    waitlist.userId = context.user.id;
    waitlist.parkingId = parkingId;
    waitlist.desiredStartTime = desiredStartTime;
    waitlist.desiredEndTime = desiredEndTime;
    waitlist.requiredSpaces = requiredSpaces;
    if (vehicleInfo) {
      waitlist.vehicleInfo = {
        licensePlate: vehicleInfo,
        vehicleType: 'car'
      };
    }
    waitlist.specialRequests = specialRequests;
    waitlist.position = currentWaitlistCount + 1;
    waitlist.status = WaitlistStatus.ACTIVE;

    // Set expiration time (24 hours after desired start time)
    waitlist.expiresAt = new Date(desiredStartTime.getTime() + 24 * 60 * 60 * 1000);

    const savedWaitlist = await waitlistRepository.save(waitlist);

    // Send confirmation notification
    await this.notificationService.sendNotification(context.user.id, {
      title: 'Joined Waitlist',
      body: `You've been added to the waitlist for ${parking.name}. Position: ${waitlist.position}`,
      type: 'waitlist',
      data: {
        waitlistId: savedWaitlist.id,
        parkingName: parking.name,
        position: waitlist.position
      }
    });

    return savedWaitlist;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async leaveWaitlist(
    @Arg('waitlistId', () => ID) waitlistId: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    if (!context.user) {
      throw new Error('Authentication required');
    }
    
    const waitlistRepository = AppDataSource.getRepository(Waitlist);

    const waitlist = await waitlistRepository.findOne({
      where: {
        id: waitlistId,
        userId: context.user.id
      },
      relations: ['parking']
    });

    if (!waitlist) {
      throw new Error('Waitlist entry not found');
    }

    if (waitlist.status !== WaitlistStatus.ACTIVE && waitlist.status !== WaitlistStatus.NOTIFIED) {
      throw new Error('Cannot leave waitlist - entry is not active');
    }

    waitlist.markAsCancelled();
    await waitlistRepository.save(waitlist);

    // Update positions for other waitlist entries
    await this.updateWaitlistPositions(waitlist.parkingId);

    // Send confirmation notification
    await this.notificationService.sendNotification(context.user.id, {
      title: 'Left Waitlist',
      body: `You've been removed from the waitlist for ${waitlist.parking.name}`,
      type: 'waitlist',
      data: {
        waitlistId: waitlist.id,
        parkingName: waitlist.parking.name
      }
    });

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async convertWaitlistToBooking(
    @Arg('waitlistId', () => ID) waitlistId: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    if (!context.user) {
      throw new Error('Authentication required');
    }
    const waitlistRepository = AppDataSource.getRepository(Waitlist);
    const bookingRepository = AppDataSource.getRepository(Booking);
    const parkingRepository = AppDataSource.getRepository(Parking);

    const waitlist = await waitlistRepository.findOne({
      where: {
        id: waitlistId,
        userId: context.user.id,
        status: WaitlistStatus.NOTIFIED
      },
      relations: ['parking']
    });

    if (!waitlist) {
      throw new Error('Waitlist entry not found or not available for conversion');
    }

    // Check if still available
    const conflictingBookings = await bookingRepository.count({
      where: {
        parkingId: waitlist.parkingId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
        startTime: LessThan(waitlist.desiredEndTime),
        endTime: MoreThan(waitlist.desiredStartTime)
      }
    });

    const parking = await parkingRepository.findOne({ where: { id: waitlist.parkingId } });
    if (!parking) {
      throw new Error('Parking not found');
    }

    const availableSpaces = parking.totalSpaces - conflictingBookings;
    if (availableSpaces < waitlist.requiredSpaces) {
      throw new Error('Parking is no longer available');
    }

    // Calculate pricing (simplified - you may want to use your pricing service)
    const duration = (waitlist.desiredEndTime.getTime() - waitlist.desiredStartTime.getTime()) / (1000 * 60 * 60);
    const totalAmount = duration * parking.pricing.hourly;

    // Create booking
    const booking = new Booking();
    booking.userId = context.user.id;
    booking.parkingId = waitlist.parkingId;
    booking.startTime = waitlist.desiredStartTime;
    booking.endTime = waitlist.desiredEndTime;
    booking.totalAmount = totalAmount;
    booking.status = BookingStatus.CONFIRMED;
    booking.paymentStatus = PaymentStatus.PENDING;
    booking.vehicleInfo = waitlist.vehicleInfo || {
      licensePlate: '',
      vehicleType: 'car'
    };
    booking.specialRequests = waitlist.specialRequests;

    const savedBooking = await bookingRepository.save(booking);

    // Mark waitlist as converted
    waitlist.markAsConverted(savedBooking.id);
    await waitlistRepository.save(waitlist);

    // Update positions for remaining waitlist entries
    await this.updateWaitlistPositions(waitlist.parkingId);

    // Send confirmation notification
    await this.notificationService.sendBookingConfirmation(
      context.user.id,
      savedBooking.bookingReference,
      parking.name,
      savedBooking.startTime
    );

    // Emit WebSocket event
    if (this.webSocketService) {
      this.webSocketService.emitBookingStatusUpdate(
        savedBooking.id,
        savedBooking.status,
        context.user.id
      );
    }

    return true;
  }

  @Query(() => [WaitlistType])
  @UseMiddleware(AuthMiddleware)
  async myWaitlistEntries(
    @Ctx() context: Context
  ): Promise<Waitlist[]> {
    if (!context.user) {
      throw new Error('Authentication required');
    }
    
    const waitlistRepository = AppDataSource.getRepository(Waitlist);
    
    return await waitlistRepository.find({
      where: {
        userId: context.user.id,
        status: In([WaitlistStatus.ACTIVE, WaitlistStatus.NOTIFIED])
      },
      relations: ['parking'],
      order: { createdAt: 'DESC' }
    });
  }

  @Query(() => [WaitlistType])
  @UseMiddleware(AuthMiddleware)
  async waitlistHistory(
    @Ctx() context: Context
  ): Promise<Waitlist[]> {
    if (!context.user) {
      throw new Error('Authentication required');
    }
    
    const waitlistRepository = AppDataSource.getRepository(Waitlist);
    
    return await waitlistRepository.find({
      where: {
        userId: context.user.id
      },
      relations: ['parking'],
      order: { createdAt: 'DESC' },
      take: 50 // Limit to last 50 entries
    });
  }

  @Query(() => Number)
  @UseMiddleware(AuthMiddleware)
  async getWaitlistPosition(
    @Arg('waitlistId', () => ID) waitlistId: string,
    @Ctx() context: Context
  ): Promise<number> {
    if (!context.user) {
      throw new Error('Authentication required');
    }
    
    const waitlistRepository = AppDataSource.getRepository(Waitlist);
    
    const waitlist = await waitlistRepository.findOne({
      where: {
        id: waitlistId,
        userId: context.user.id
      }
    });

    if (!waitlist) {
      throw new Error('Waitlist entry not found');
    }

    return waitlist.position;
  }

  // Helper method to update waitlist positions after someone leaves
  private async updateWaitlistPositions(parkingId: string): Promise<void> {
    const waitlistRepository = AppDataSource.getRepository(Waitlist);

    const activeWaitlists = await waitlistRepository.find({
      where: {
        parkingId,
        status: WaitlistStatus.ACTIVE
      },
      order: {
        createdAt: 'ASC'
      }
    });

    // Update positions
    activeWaitlists.forEach((waitlist, index) => {
      waitlist.position = index + 1;
    });

    await waitlistRepository.save(activeWaitlists);
  }
}