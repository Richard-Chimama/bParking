import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { User } from './User';
import { Parking } from './Parking';

export enum RecurrencePattern {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  WEEKDAYS = 'weekdays', // Monday to Friday
  WEEKENDS = 'weekends', // Saturday and Sunday
  CUSTOM = 'custom'
}

export enum RecurringBookingStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

@Entity('recurring_bookings')
@Index(['user'])
@Index(['parking'])
@Index(['status'])
@Index(['pattern'])
@Index(['nextBookingDate'])
@Index(['createdAt'])
export class RecurringBooking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: string;

  @ManyToOne(() => Parking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parkingId' })
  parking!: Parking;

  @Column()
  parkingId!: string;

  @Column({
    type: 'enum',
    enum: RecurrencePattern,
    default: RecurrencePattern.WEEKLY,
  })
  pattern!: RecurrencePattern;

  @Column({
    type: 'enum',
    enum: RecurringBookingStatus,
    default: RecurringBookingStatus.ACTIVE,
  })
  status!: RecurringBookingStatus;

  @Column({ type: 'time' })
  startTime!: string; // Format: HH:MM

  @Column({ type: 'time' })
  endTime!: string; // Format: HH:MM

  @Column({ type: 'int', default: 1 })
  duration!: number; // Duration in hours

  @Column({ type: 'date' })
  startDate!: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date; // If null, recurring indefinitely

  @Column({ type: 'date' })
  nextBookingDate!: Date;

  @Column({ type: 'int', nullable: true })
  maxOccurrences?: number; // Maximum number of bookings to create

  @Column({ type: 'int', default: 0 })
  completedOccurrences!: number;

  @Column({ type: 'jsonb', nullable: true })
  customPattern?: {
    daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
    daysOfMonth?: number[]; // 1-31
    interval?: number; // Every N days/weeks/months
    excludeDates?: string[]; // ISO date strings to exclude
  };

  @Column({ type: 'jsonb' })
  vehicleInfo!: {
    licensePlate: string;
    vehicleType: string;
    color?: string;
    make?: string;
    model?: string;
  };

  @Column({ type: 'text', nullable: true })
  specialRequests?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice!: number;

  @Column({ type: 'varchar', length: 3, default: 'ZMW' })
  currency!: string;

  @Column({ type: 'boolean', default: true })
  autoPayment!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  paymentMethod?: {
    type: 'card' | 'mobile_money' | 'wallet';
    provider?: string;
    lastFour?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  bookingHistory?: {
    bookingId: string;
    date: string;
    status: 'created' | 'failed' | 'cancelled';
    reason?: string;
    createdAt: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  failureHistory?: {
    date: string;
    reason: string;
    retryCount: number;
    nextRetry?: string;
  }[];

  @Column({ type: 'timestamp', nullable: true })
  lastBookingCreated?: Date;

  @Column({ type: 'timestamp', nullable: true })
  pausedAt?: Date;

  @Column({ type: 'text', nullable: true })
  pauseReason?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Virtual properties
  get isActive(): boolean {
    return this.status === RecurringBookingStatus.ACTIVE;
  }

  get isPaused(): boolean {
    return this.status === RecurringBookingStatus.PAUSED;
  }

  get isCompleted(): boolean {
    return this.status === RecurringBookingStatus.COMPLETED ||
           Boolean(this.maxOccurrences && this.completedOccurrences >= this.maxOccurrences) ||
           Boolean(this.endDate && new Date() > this.endDate);
  }

  get remainingOccurrences(): number | null {
    if (!this.maxOccurrences) return null;
    return Math.max(0, this.maxOccurrences - this.completedOccurrences);
  }

  get totalBookingsCreated(): number {
    return this.bookingHistory?.length || 0;
  }

  get successfulBookings(): number {
    return this.bookingHistory?.filter(b => b.status === 'created').length || 0;
  }

  get failedBookings(): number {
    return this.bookingHistory?.filter(b => b.status === 'failed').length || 0;
  }

  // Instance methods
  shouldCreateBooking(): boolean {
    if (!this.isActive || this.isCompleted) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextBooking = new Date(this.nextBookingDate);
    nextBooking.setHours(0, 0, 0, 0);
    
    return today >= nextBooking;
  }

  calculateNextBookingDate(): Date {
    const current = new Date(this.nextBookingDate);
    
    switch (this.pattern) {
      case RecurrencePattern.DAILY:
        current.setDate(current.getDate() + (this.customPattern?.interval || 1));
        break;
        
      case RecurrencePattern.WEEKLY:
        current.setDate(current.getDate() + 7 * (this.customPattern?.interval || 1));
        break;
        
      case RecurrencePattern.MONTHLY:
        current.setMonth(current.getMonth() + (this.customPattern?.interval || 1));
        break;
        
      case RecurrencePattern.WEEKDAYS:
        do {
          current.setDate(current.getDate() + 1);
        } while (current.getDay() === 0 || current.getDay() === 6); // Skip weekends
        break;
        
      case RecurrencePattern.WEEKENDS:
        do {
          current.setDate(current.getDate() + 1);
        } while (current.getDay() !== 0 && current.getDay() !== 6); // Only weekends
        break;
        
      case RecurrencePattern.CUSTOM:
        if (this.customPattern?.daysOfWeek) {
          const targetDays = this.customPattern.daysOfWeek;
          do {
            current.setDate(current.getDate() + 1);
          } while (!targetDays.includes(current.getDay()));
        } else {
          current.setDate(current.getDate() + 1);
        }
        break;
    }
    
    return current;
  }

  updateNextBookingDate(): void {
    this.nextBookingDate = this.calculateNextBookingDate();
  }

  addBookingToHistory(bookingId: string, status: 'created' | 'failed' | 'cancelled', reason?: string): void {
    if (!this.bookingHistory) {
      this.bookingHistory = [];
    }
    
    this.bookingHistory.push({
      bookingId,
      date: this.nextBookingDate.toISOString().split('T')[0] || '',
      status,
      reason,
      createdAt: new Date().toISOString()
    });
    
    if (status === 'created') {
      this.completedOccurrences++;
      this.lastBookingCreated = new Date();
    }
  }

  addFailureToHistory(reason: string, retryCount: number = 0): void {
    if (!this.failureHistory) {
      this.failureHistory = [];
    }
    
    this.failureHistory.push({
      date: new Date().toISOString().split('T')[0] || '',
      reason,
      retryCount,
      nextRetry: retryCount < 3 ? new Date(Date.now() + (retryCount + 1) * 60 * 60 * 1000).toISOString() : undefined
    });
  }

  pause(reason?: string): void {
    this.status = RecurringBookingStatus.PAUSED;
    this.pausedAt = new Date();
    this.pauseReason = reason;
  }

  resume(): void {
    this.status = RecurringBookingStatus.ACTIVE;
    this.pausedAt = undefined;
    this.pauseReason = undefined;
  }

  cancel(): void {
    this.status = RecurringBookingStatus.CANCELLED;
  }

  complete(): void {
    this.status = RecurringBookingStatus.COMPLETED;
  }

  // Lifecycle hooks
  @BeforeInsert()
  setDefaults() {
    if (!this.nextBookingDate) {
      this.nextBookingDate = this.startDate;
    }
  }
}