import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './User';

export enum NotificationType {
  BOOKING_CONFIRMATION = 'booking_confirmation',
  BOOKING_REMINDER = 'booking_reminder',
  BOOKING_CANCELLATION = 'booking_cancellation',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  WAITLIST_AVAILABLE = 'waitlist_available',
  WAITLIST_POSITION_UPDATE = 'waitlist_position_update',
  RECURRING_BOOKING_CREATED = 'recurring_booking_created',
  RECURRING_BOOKING_FAILED = 'recurring_booking_failed',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  PROMOTIONAL = 'promotional',
  GENERAL = 'general'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export enum NotificationChannel {
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app'
}

@Entity('notifications')
@Index(['user'])
@Index(['type'])
@Index(['status'])
@Index(['channel'])
@Index(['createdAt'])
@Index(['readAt'])
@Index(['user', 'status']) // Composite index for user notifications
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type!: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
  })
  channel!: NotificationChannel;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: {
    bookingId?: string;
    paymentId?: string;
    parkingId?: string;
    waitlistId?: string;
    recurringBookingId?: string;
    amount?: number;
    currency?: string;
    actionUrl?: string;
    imageUrl?: string;
    [key: string]: any;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actionUrl?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  actionText?: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduledFor?: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'int', default: 3 })
  maxRetries!: number;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt?: Date;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    fcmMessageId?: string;
    emailMessageId?: string;
    smsMessageId?: string;
    deviceInfo?: {
      platform: string;
      version: string;
    };
    [key: string]: any;
  };

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Virtual properties
  get isRead(): boolean {
    return this.status === NotificationStatus.READ;
  }

  get isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  get canRetry(): boolean {
    return this.status === NotificationStatus.FAILED && 
           this.retryCount < this.maxRetries &&
           !this.isExpired;
  }

  get isScheduled(): boolean {
    return this.scheduledFor ? new Date() < this.scheduledFor : false;
  }

  get shouldSend(): boolean {
    return this.status === NotificationStatus.PENDING &&
           !this.isExpired &&
           (!this.scheduledFor || new Date() >= this.scheduledFor);
  }

  // Instance methods
  markAsSent(): void {
    this.status = NotificationStatus.SENT;
    this.sentAt = new Date();
  }

  markAsDelivered(): void {
    this.status = NotificationStatus.DELIVERED;
    this.deliveredAt = new Date();
  }

  markAsRead(): void {
    this.status = NotificationStatus.READ;
    this.readAt = new Date();
  }

  markAsFailed(reason: string): void {
    this.status = NotificationStatus.FAILED;
    this.failureReason = reason;
    this.retryCount++;
    
    if (this.canRetry) {
      // Exponential backoff: 1min, 5min, 15min
      const backoffMinutes = Math.pow(5, this.retryCount - 1);
      this.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
    }
  }

  resetForRetry(): void {
    this.status = NotificationStatus.PENDING;
    this.failureReason = undefined;
    this.nextRetryAt = undefined;
  }

  addMetadata(key: string, value: any): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata[key] = value;
  }

  // Static helper methods
  static createBookingConfirmation(userId: string, data: {
    bookingId: string;
    parkingName: string;
    startTime: Date;
    bookingReference: string;
  }): Partial<Notification> {
    return {
      userId,
      type: NotificationType.BOOKING_CONFIRMATION,
      channel: NotificationChannel.PUSH,
      title: 'Booking Confirmed! 🎉',
      message: `Your parking at ${data.parkingName} is confirmed for ${data.startTime.toLocaleDateString()} at ${data.startTime.toLocaleTimeString()}`,
      data: {
        bookingId: data.bookingId,
        parkingName: data.parkingName,
        startTime: data.startTime.toISOString(),
        bookingReference: data.bookingReference,
        actionUrl: `/bookings/${data.bookingId}`,
      },
      actionText: 'View Booking',
      actionUrl: `/bookings/${data.bookingId}`,
    };
  }

  static createPaymentSuccess(userId: string, data: {
    paymentId: string;
    amount: number;
    currency: string;
    bookingReference: string;
  }): Partial<Notification> {
    return {
      userId,
      type: NotificationType.PAYMENT_SUCCESS,
      channel: NotificationChannel.PUSH,
      title: 'Payment Successful ✅',
      message: `Your payment of ${data.currency} ${data.amount} for booking ${data.bookingReference} was successful`,
      data: {
        paymentId: data.paymentId,
        amount: data.amount,
        currency: data.currency,
        bookingReference: data.bookingReference,
      },
    };
  }

  static createWaitlistAvailable(userId: string, data: {
    waitlistId: string;
    parkingName: string;
    availableUntil: Date;
  }): Partial<Notification> {
    return {
      userId,
      type: NotificationType.WAITLIST_AVAILABLE,
      channel: NotificationChannel.PUSH,
      title: 'Parking Available! 🎯',
      message: `A spot at ${data.parkingName} is now available! Reserve it before ${data.availableUntil.toLocaleTimeString()}`,
      data: {
        waitlistId: data.waitlistId,
        parkingName: data.parkingName,
        availableUntil: data.availableUntil.toISOString(),
      },
      actionText: 'Book Now',
      expiresAt: data.availableUntil,
    };
  }

  static createBookingReminder(userId: string, data: {
    bookingId: string;
    parkingName: string;
    startTime: Date;
    bookingReference: string;
  }): Partial<Notification> {
    return {
      userId,
      type: NotificationType.BOOKING_REMINDER,
      channel: NotificationChannel.PUSH,
      title: 'Parking Reminder 🚗',
      message: `Your parking at ${data.parkingName} starts in 30 minutes. Don't forget to check in!`,
      data: {
        bookingId: data.bookingId,
        parkingName: data.parkingName,
        startTime: data.startTime.toISOString(),
        bookingReference: data.bookingReference,
      },
      actionText: 'Check In',
      actionUrl: `/bookings/${data.bookingId}/checkin`,
    };
  }
}