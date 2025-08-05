import cron from 'node-cron';
import { AppDataSource } from '../database/connection';
import { RecurringBooking, RecurringBookingStatus } from '../entities/RecurringBooking';
import { Booking, BookingStatus, PaymentStatus } from '../entities/Booking';
import { Waitlist, WaitlistStatus } from '../entities/Waitlist';
import { Notification, NotificationStatus } from '../entities/Notification';
import { Parking } from '../entities/Parking';
import NotificationService from './notification';
import WebSocketService from './websocket';
import { MoreThan, LessThan, In, And } from 'typeorm';

class SchedulerService {
  private notificationService: NotificationService;
  private webSocketService?: WebSocketService;
  private isRunning: boolean = false;
  private cronJobs: any[] = [];

  constructor(notificationService: NotificationService, webSocketService?: WebSocketService) {
    this.notificationService = notificationService;
    this.webSocketService = webSocketService;
  }

  start(): void {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting scheduler service...');

    // Process recurring bookings every hour
    const recurringBookingJob = cron.schedule('0 * * * *', async () => {
      console.log('Processing recurring bookings...');
      await this.processRecurringBookings();
    });
    this.cronJobs.push(recurringBookingJob);

    // Process waitlist every 5 minutes
    const waitlistJob = cron.schedule('*/5 * * * *', async () => {
      console.log('Processing waitlist...');
      await this.processWaitlist();
    });
    this.cronJobs.push(waitlistJob);

    // Send booking reminders every 15 minutes
    const reminderJob = cron.schedule('*/15 * * * *', async () => {
      console.log('Sending booking reminders...');
      await this.sendBookingReminders();
    });
    this.cronJobs.push(reminderJob);

    // Process pending notifications every minute
    const notificationJob = cron.schedule('* * * * *', async () => {
      await this.processPendingNotifications();
    });
    this.cronJobs.push(notificationJob);

    // Clean up expired waitlist entries daily at 2 AM
    const cleanupWaitlistJob = cron.schedule('0 2 * * *', async () => {
      console.log('Cleaning up expired waitlist entries...');
      await this.cleanupExpiredWaitlistEntries();
    });
    this.cronJobs.push(cleanupWaitlistJob);

    // Clean up old notifications weekly
    const cleanupNotificationsJob = cron.schedule('0 3 * * 0', async () => {
      console.log('Cleaning up old notifications...');
      await this.cleanupOldNotifications();
    });
    this.cronJobs.push(cleanupNotificationsJob);

    console.log('Scheduler service started successfully');
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    this.isRunning = false;
    this.cronJobs.forEach(job => job.destroy());
    this.cronJobs = [];
    console.log('Scheduler service stopped');
  }

  // Process recurring bookings that are due
  private async processRecurringBookings(): Promise<void> {
    try {
      const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);
      const bookingRepository = AppDataSource.getRepository(Booking);
      const parkingRepository = AppDataSource.getRepository(Parking);

      // Get all active recurring bookings that should create a booking today
      const dueRecurringBookings = await recurringBookingRepository.find({
        where: {
          status: RecurringBookingStatus.ACTIVE,
          nextBookingDate: LessThan(new Date())
        },
        relations: ['user', 'parking']
      });

      for (const recurringBooking of dueRecurringBookings) {
        try {
          // Check if parking is available
          const parking = await parkingRepository.findOne({
            where: { id: recurringBooking.parkingId }
          });

          if (!parking) {
            recurringBooking.addFailureToHistory('Parking not found');
            continue;
          }

          // Create the booking date and time
          const bookingDate = new Date(recurringBooking.nextBookingDate);
          const timeParts = recurringBooking.startTime.split(':');
          const endTimeParts = recurringBooking.endTime.split(':');
          
          if (timeParts.length !== 2 || endTimeParts.length !== 2) {
            throw new Error('Invalid time format in recurring booking');
          }
          
          const startHour = parseInt(timeParts[0]!, 10);
          const startMinute = parseInt(timeParts[1]!, 10);
          const endHour = parseInt(endTimeParts[0]!, 10);
          const endMinute = parseInt(endTimeParts[1]!, 10);
          
          // Ensure we have valid hour and minute values
          if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
            throw new Error('Invalid time format in recurring booking');
          }

          const startTime = new Date(bookingDate);
          startTime.setHours(startHour, startMinute, 0, 0);

          const endTime = new Date(bookingDate);
          endTime.setHours(endHour, endMinute, 0, 0);

          // Check for conflicts
          const conflictingBookings = await bookingRepository.count({
            where: {
              parkingId: recurringBooking.parkingId,
              status: In([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
              startTime: LessThan(endTime),
              endTime: MoreThan(startTime)
            }
          });

          if (conflictingBookings > 0) {
            recurringBooking.addFailureToHistory('Time slot not available');
            recurringBooking.updateNextBookingDate();
            await recurringBookingRepository.save(recurringBooking);
            continue;
          }

          // Create the booking
          const booking = new Booking();
          booking.userId = recurringBooking.userId;
          booking.parkingId = recurringBooking.parkingId;
          booking.startTime = startTime;
          booking.endTime = endTime;
          booking.totalAmount = recurringBooking.basePrice;
          booking.status = BookingStatus.CONFIRMED;
          booking.paymentStatus = PaymentStatus.PENDING;
          booking.vehicleInfo = recurringBooking.vehicleInfo;
          booking.specialRequests = recurringBooking.specialRequests;

          const savedBooking = await bookingRepository.save(booking);

          // Update recurring booking
          recurringBooking.addBookingToHistory(savedBooking.id, 'created');
          recurringBooking.updateNextBookingDate();
          await recurringBookingRepository.save(recurringBooking);

          // Send notification
          await this.notificationService.sendNotification(recurringBooking.userId, {
            title: 'Recurring Booking Created',
            body: `Your recurring booking at ${parking.name} has been created for ${startTime.toLocaleDateString()}`,
            type: 'booking',
            data: {
              bookingId: savedBooking.id,
              recurringBookingId: recurringBooking.id,
              parkingName: parking.name
            }
          });

          console.log(`Created recurring booking ${savedBooking.id} for user ${recurringBooking.userId}`);

        } catch (error) {
          console.error(`Error processing recurring booking ${recurringBooking.id}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          recurringBooking.addFailureToHistory(`Error: ${errorMessage}`);
          await recurringBookingRepository.save(recurringBooking);
        }
      }

    } catch (error) {
      console.error('Error processing recurring bookings:', error);
    }
  }

  // Process waitlist and notify users when spots become available
  private async processWaitlist(): Promise<void> {
    try {
      const waitlistRepository = AppDataSource.getRepository(Waitlist);
      const bookingRepository = AppDataSource.getRepository(Booking);
      const parkingRepository = AppDataSource.getRepository(Parking);

      // Get all active waitlist entries
      const activeWaitlists = await waitlistRepository.find({
        where: {
          status: WaitlistStatus.ACTIVE
        },
        relations: ['user', 'parking'],
        order: {
          parkingId: 'ASC',
          position: 'ASC'
        }
      });

      // Group by parking
      const waitlistsByParking = activeWaitlists.reduce((acc, waitlist) => {
        if (!acc[waitlist.parkingId]) {
          acc[waitlist.parkingId] = [];
        }
        acc[waitlist.parkingId]!.push(waitlist);
        return acc;
      }, {} as Record<string, Waitlist[]>);

      for (const [parkingId, waitlists] of Object.entries(waitlistsByParking)) {
        const parking = await parkingRepository.findOne({ where: { id: parkingId } });
        if (!parking) continue;

        // Check availability for each waitlist entry
        for (const waitlist of waitlists) {
          const conflictingBookings = await bookingRepository.count({
            where: {
              parkingId: waitlist.parkingId,
              status: In([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
              startTime: LessThan(waitlist.desiredEndTime),
              endTime: MoreThan(waitlist.desiredStartTime)
            }
          });

          const availableSpaces = parking.totalSpaces - conflictingBookings;

          if (availableSpaces >= waitlist.requiredSpaces) {
            // Notify user about availability
            const availableUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            
            waitlist.markAsNotified();
            await waitlistRepository.save(waitlist);

            // Send notification
            await this.notificationService.sendWaitlistAvailable(
              waitlist.userId,
              parking.name,
              availableUntil
            );

            // Send WebSocket notification
            if (this.webSocketService) {
              this.webSocketService.emitWaitlistAvailability(
                waitlist.userId,
                waitlist.parkingId,
                availableUntil
              );
            }

            console.log(`Notified user ${waitlist.userId} about available spot at ${parking.name}`);
          }
        }
      }

    } catch (error) {
      console.error('Error processing waitlist:', error);
    }
  }

  // Send booking reminders 30 minutes before start time
  private async sendBookingReminders(): Promise<void> {
    try {
      const bookingRepository = AppDataSource.getRepository(Booking);
      const parkingRepository = AppDataSource.getRepository(Parking);

      const reminderTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const reminderTimeEnd = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes from now

      const upcomingBookings = await bookingRepository.find({
        where: {
          status: BookingStatus.CONFIRMED,
          startTime: And(MoreThan(reminderTime), LessThan(reminderTimeEnd))
        },
        relations: ['user', 'parking']
      });

      for (const booking of upcomingBookings) {
        const parking = await parkingRepository.findOne({ where: { id: booking.parkingId } });
        if (!parking) continue;

        await this.notificationService.sendBookingReminder(
          booking.userId,
          booking.bookingReference,
          parking.name,
          booking.startTime
        );

        console.log(`Sent reminder for booking ${booking.id} to user ${booking.userId}`);
      }

    } catch (error) {
      console.error('Error sending booking reminders:', error);
    }
  }

  // Process pending notifications
  private async processPendingNotifications(): Promise<void> {
    try {
      const notificationRepository = AppDataSource.getRepository(Notification);

      const pendingNotifications = await notificationRepository.find({
        where: {
          status: NotificationStatus.PENDING,
          scheduledFor: LessThan(new Date())
        },
        take: 50 // Process in batches
      });

      for (const notification of pendingNotifications) {
        try {
          const success = await this.notificationService.sendPushNotification(notification.userId, {
            title: notification.title,
            body: notification.message,
            type: notification.type as any,
            data: notification.data
          });

          if (success) {
            notification.markAsSent();
          } else {
            notification.markAsFailed('Failed to send push notification');
          }

          await notificationRepository.save(notification);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          notification.markAsFailed(errorMessage);
          await notificationRepository.save(notification);
        }
      }

    } catch (error) {
      console.error('Error processing pending notifications:', error);
    }
  }

  // Clean up expired waitlist entries
  private async cleanupExpiredWaitlistEntries(): Promise<void> {
    try {
      const waitlistRepository = AppDataSource.getRepository(Waitlist);

      const expiredEntries = await waitlistRepository.find({
        where: {
          status: In([WaitlistStatus.ACTIVE, WaitlistStatus.NOTIFIED]),
          expiresAt: LessThan(new Date())
        }
      });

      for (const entry of expiredEntries) {
        entry.markAsExpired();
      }

      await waitlistRepository.save(expiredEntries);
      console.log(`Cleaned up ${expiredEntries.length} expired waitlist entries`);

    } catch (error) {
      console.error('Error cleaning up expired waitlist entries:', error);
    }
  }

  // Clean up old notifications (older than 30 days)
  private async cleanupOldNotifications(): Promise<void> {
    try {
      const notificationRepository = AppDataSource.getRepository(Notification);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await notificationRepository.delete({
        createdAt: LessThan(thirtyDaysAgo),
        status: In([NotificationStatus.READ, NotificationStatus.DELIVERED])
      });

      console.log(`Cleaned up ${result.affected} old notifications`);

    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }

  // Manual trigger methods for testing
  async triggerRecurringBookings(): Promise<void> {
    await this.processRecurringBookings();
  }

  async triggerWaitlistProcessing(): Promise<void> {
    await this.processWaitlist();
  }

  async triggerBookingReminders(): Promise<void> {
    await this.sendBookingReminders();
  }
}

export default SchedulerService;