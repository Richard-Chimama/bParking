import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
  Index,
} from 'typeorm';
import { User } from './User';
import { Parking } from './Parking';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIAL_REFUND = 'partial_refund'
}

@Entity('bookings')
@Index(['user'])
@Index(['parking'])
@Index(['status'])
@Index(['startTime'])
@Index(['endTime'])
@Index(['bookingReference'], { unique: true })
@Index(['createdAt'])
export class Booking {
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

  @Column({ length: 50 })
  spaceId!: string; // Reference to specific parking space

  @Column({ type: 'timestamp' })
  startTime!: Date;

  @Column({ type: 'timestamp' })
  endTime!: Date;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status!: BookingStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus!: PaymentStatus;

  @Column({ nullable: true })
  paymentId?: string;

  @Column({ unique: true, length: 20 })
  bookingReference!: string;

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

  @Column({ type: 'timestamp', nullable: true })
  checkInTime?: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkOutTime?: Date;

  @Column({ type: 'jsonb', nullable: true })
  cancellationReason?: {
    reason: string;
    cancelledBy: 'user' | 'admin' | 'system';
    refundAmount?: number;
    cancelledAt: Date;
  };

  @Column({ type: 'jsonb', nullable: true })
  extensionHistory?: {
    originalEndTime: Date;
    newEndTime: Date;
    additionalAmount: number;
    extendedAt: Date;
  }[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Virtual properties
  get duration(): number {
    return Math.ceil((this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60 * 60)); // hours
  }

  get isActive(): boolean {
    const now = new Date();
    return this.status === BookingStatus.ACTIVE && 
           this.startTime <= now && 
           this.endTime > now;
  }

  get isExpired(): boolean {
    return new Date() > this.endTime;
  }

  get canCheckIn(): boolean {
    const now = new Date();
    const checkInWindow = 15 * 60 * 1000; // 15 minutes before start time
    return this.status === BookingStatus.CONFIRMED &&
           !this.checkInTime &&
           now >= new Date(this.startTime.getTime() - checkInWindow) &&
           now <= this.endTime;
  }

  get canCheckOut(): boolean {
    return this.status === BookingStatus.ACTIVE && 
           !!this.checkInTime && 
           !this.checkOutTime;
  }

  // Lifecycle hooks
  @BeforeInsert()
  generateBookingReference() {
    if (!this.bookingReference) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      this.bookingReference = `BP${timestamp}${random}`.toUpperCase();
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  validateBookingTimes() {
    if (this.startTime >= this.endTime) {
      throw new Error('Start time must be before end time');
    }
    
    if (this.startTime < new Date()) {
      throw new Error('Start time cannot be in the past');
    }
  }

  // Instance methods
  canBeCancelled(): boolean {
    const now = new Date();
    const cancellationDeadline = new Date(this.startTime.getTime() - (2 * 60 * 60 * 1000)); // 2 hours before
    
    return [BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(this.status) &&
           now < cancellationDeadline;
  }

  calculateRefundAmount(): number {
    if (!this.canBeCancelled()) return 0;
    
    const now = new Date();
    const hoursUntilStart = (this.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Refund policy: 100% if cancelled 24+ hours before, 50% if 2-24 hours before
    if (hoursUntilStart >= 24) {
      return this.totalAmount;
    } else if (hoursUntilStart >= 2) {
      return this.totalAmount * 0.5;
    }
    
    return 0;
  }

  canBeExtended(): boolean {
    return this.status === BookingStatus.ACTIVE && 
           !this.isExpired &&
           this.checkInTime !== undefined;
  }
}