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

export enum WaitlistStatus {
  ACTIVE = 'active',
  NOTIFIED = 'notified',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  CONVERTED = 'converted'
}

@Entity('waitlists')
@Index(['user'])
@Index(['parking'])
@Index(['status'])
@Index(['position'])
@Index(['createdAt'])
@Index(['parking', 'status', 'position']) // Composite index for efficient querying
export class Waitlist {
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
    enum: WaitlistStatus,
    default: WaitlistStatus.ACTIVE,
  })
  status!: WaitlistStatus;

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'timestamp' })
  desiredStartTime!: Date;

  @Column({ type: 'timestamp' })
  desiredEndTime!: Date;

  @Column({ type: 'int', default: 1 })
  requiredSpaces!: number;

  @Column({ type: 'jsonb', nullable: true })
  vehicleInfo?: {
    licensePlate: string;
    vehicleType: string;
    color?: string;
    make?: string;
    model?: string;
  };

  @Column({ type: 'text', nullable: true })
  specialRequests?: string;

  @Column({ type: 'timestamp', nullable: true })
  notifiedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  convertedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  convertedBookingId?: string;

  @Column({ type: 'jsonb', nullable: true })
  notificationHistory?: {
    sentAt: Date;
    type: 'position_update' | 'availability_alert' | 'expiry_warning';
    message: string;
  }[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Virtual properties
  get isActive(): boolean {
    return this.status === WaitlistStatus.ACTIVE;
  }

  get isExpired(): boolean {
    return this.status === WaitlistStatus.EXPIRED || 
           (this.expiresAt ? new Date() > this.expiresAt : false);
  }

  get waitingTime(): number {
    return Date.now() - this.createdAt.getTime();
  }

  get waitingTimeHours(): number {
    return Math.floor(this.waitingTime / (1000 * 60 * 60));
  }

  // Instance methods
  canBeNotified(): boolean {
    return this.status === WaitlistStatus.ACTIVE && !this.isExpired;
  }

  markAsNotified(): void {
    this.status = WaitlistStatus.NOTIFIED;
    this.notifiedAt = new Date();
    // Set expiry time (e.g., 15 minutes to respond)
    this.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  }

  markAsConverted(bookingId: string): void {
    this.status = WaitlistStatus.CONVERTED;
    this.convertedAt = new Date();
    this.convertedBookingId = bookingId;
  }

  markAsExpired(): void {
    this.status = WaitlistStatus.EXPIRED;
  }

  markAsCancelled(): void {
    this.status = WaitlistStatus.CANCELLED;
  }

  addNotificationHistory(type: 'position_update' | 'availability_alert' | 'expiry_warning', message: string): void {
    if (!this.notificationHistory) {
      this.notificationHistory = [];
    }
    
    this.notificationHistory.push({
      sentAt: new Date(),
      type,
      message
    });
  }

  // Lifecycle hooks
  @BeforeInsert()
  setDefaults() {
    if (!this.expiresAt) {
      // Default expiry: 24 hours from creation
      this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }
}