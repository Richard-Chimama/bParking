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
import { Booking } from './Booking';

export enum PaymentMethod {
  MTN_MOBILE_MONEY = 'mtn_mobile_money',
  AIRTEL_MONEY = 'airtel_money',
  ZAMTEL_KWACHA = 'zamtel_kwacha',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIAL_REFUND = 'partial_refund',
  EXPIRED = 'expired'
}

export enum PaymentProvider {
  MTN_ZAMBIA = 'mtn_zambia',
  AIRTEL_ZAMBIA = 'airtel_zambia',
  ZAMTEL = 'zamtel',
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  MANUAL = 'manual'
}

@Entity('payments')
@Index(['user'])
@Index(['booking'])
@Index(['status'])
@Index(['paymentMethod'])
@Index(['transactionId'], { unique: true })
@Index(['providerTransactionId'])
@Index(['createdAt'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @Column()
  bookingId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ length: 3, default: 'ZMW' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod!: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
  })
  provider!: PaymentProvider;

  @Column({ unique: true, length: 100 })
  transactionId!: string;

  @Column({ nullable: true, length: 100 })
  providerTransactionId?: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  @Column({ type: 'jsonb', nullable: true })
  providerResponse?: {
    responseCode?: string;
    responseMessage?: string;
    referenceId?: string;
    timestamp?: string;
    additionalData?: Record<string, any>;
  };

  @Column({ type: 'jsonb', nullable: true })
  paymentDetails?: {
    phoneNumber?: string; // For mobile money
    cardLast4?: string; // For card payments
    cardType?: string;
    bankName?: string;
    accountNumber?: string; // Masked
  };

  @Column({ type: 'jsonb', nullable: true })
  refundDetails?: {
    refundAmount: number;
    refundReason: string;
    refundedAt: Date;
    refundTransactionId?: string;
    refundedBy: string; // User ID who initiated refund
  };

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  webhookData?: {
    webhookId?: string;
    receivedAt?: Date;
    verified?: boolean;
    rawPayload?: Record<string, any>;
  };

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastRetryAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Virtual properties
  get isCompleted(): boolean {
    return this.status === PaymentStatus.COMPLETED;
  }

  get isFailed(): boolean {
    return [PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED].includes(this.status);
  }

  get isPending(): boolean {
    return [PaymentStatus.PENDING, PaymentStatus.PROCESSING].includes(this.status);
  }

  get isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  get canBeRetried(): boolean {
    return this.isFailed && this.retryCount < 3 && !this.isExpired;
  }

  get isMobileMoneyPayment(): boolean {
    return [
      PaymentMethod.MTN_MOBILE_MONEY,
      PaymentMethod.AIRTEL_MONEY,
      PaymentMethod.ZAMTEL_KWACHA
    ].includes(this.paymentMethod);
  }

  get isCardPayment(): boolean {
    return [
      PaymentMethod.CREDIT_CARD,
      PaymentMethod.DEBIT_CARD
    ].includes(this.paymentMethod);
  }

  // Instance methods
  markAsCompleted(providerTransactionId?: string, providerResponse?: any): void {
    this.status = PaymentStatus.COMPLETED;
    this.paidAt = new Date();
    if (providerTransactionId) {
      this.providerTransactionId = providerTransactionId;
    }
    if (providerResponse) {
      this.providerResponse = providerResponse;
    }
  }

  markAsFailed(reason: string, providerResponse?: any): void {
    this.status = PaymentStatus.FAILED;
    this.failureReason = reason;
    if (providerResponse) {
      this.providerResponse = providerResponse;
    }
  }

  incrementRetryCount(): void {
    this.retryCount += 1;
    this.lastRetryAt = new Date();
  }

  processRefund(refundAmount: number, reason: string, refundedBy: string): void {
    const refundStatus = refundAmount >= this.amount 
      ? PaymentStatus.REFUNDED 
      : PaymentStatus.PARTIAL_REFUND;
    
    this.status = refundStatus;
    this.refundDetails = {
      refundAmount,
      refundReason: reason,
      refundedAt: new Date(),
      refundedBy
    };
  }

  // Static methods
  static generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `TXN_${timestamp}_${random}`.toUpperCase();
  }

  static getProviderForPaymentMethod(method: PaymentMethod): PaymentProvider {
    const providerMap: Record<PaymentMethod, PaymentProvider> = {
      [PaymentMethod.MTN_MOBILE_MONEY]: PaymentProvider.MTN_ZAMBIA,
      [PaymentMethod.AIRTEL_MONEY]: PaymentProvider.AIRTEL_ZAMBIA,
      [PaymentMethod.ZAMTEL_KWACHA]: PaymentProvider.ZAMTEL,
      [PaymentMethod.CREDIT_CARD]: PaymentProvider.VISA, // Default, can be overridden
      [PaymentMethod.DEBIT_CARD]: PaymentProvider.VISA, // Default, can be overridden
      [PaymentMethod.CASH]: PaymentProvider.MANUAL,
      [PaymentMethod.BANK_TRANSFER]: PaymentProvider.MANUAL
    };
    
    return providerMap[method];
  }

  static calculateExpiryTime(paymentMethod: PaymentMethod): Date {
    const now = new Date();
    const expiryMinutes = {
      [PaymentMethod.MTN_MOBILE_MONEY]: 15,
      [PaymentMethod.AIRTEL_MONEY]: 15,
      [PaymentMethod.ZAMTEL_KWACHA]: 15,
      [PaymentMethod.CREDIT_CARD]: 30,
      [PaymentMethod.DEBIT_CARD]: 30,
      [PaymentMethod.CASH]: 60 * 24, // 24 hours
      [PaymentMethod.BANK_TRANSFER]: 60 * 24 * 3 // 3 days
    };
    
    return new Date(now.getTime() + (expiryMinutes[paymentMethod] * 60 * 1000));
  }
}