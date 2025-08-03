import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { config } from '@/config';

@Entity('users')
@Index(['email'], { unique: true })
@Index(['phoneNumber'], { unique: true })
@Index(['role'])
@Index(['isVerified'])
@Index(['createdAt'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50 })
  firstName!: string;

  @Column({ length: 50 })
  lastName!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ unique: true })
  phoneNumber!: string;

  @Column()
  @Exclude()
  password!: string;

  @Column({
    type: 'enum',
    enum: ['user', 'admin', 'owner'],
    default: 'user',
  })
  role!: 'user' | 'admin' | 'owner';

  @Column({ default: false })
  isVerified!: boolean;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  @Exclude()
  otpCode?: string;

  @Column({ nullable: true })
  @Exclude()
  otpExpiresAt?: Date;

  @Column({ nullable: true })
  profilePicture?: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth?: Date;

  @Column({ type: 'jsonb', nullable: true })
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  preferences?: {
    notifications: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
  };

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ default: 0 })
  @Exclude()
  loginAttempts!: number;

  @Column({ nullable: true })
  @Exclude()
  lockUntil?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Virtual property for full name
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  // Hash password before insert/update
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && this.password.length < 60) {
      const salt = await bcrypt.genSalt(config.security.bcryptRounds);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  // Instance methods
  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }

  generateOTP(): string {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpCode = otp;
    this.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return otp;
  }

  isLocked(): boolean {
    return !!(this.lockUntil && this.lockUntil > new Date());
  }

  async incrementLoginAttempts(): Promise<void> {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockUntil && this.lockUntil < new Date()) {
      this.lockUntil = undefined;
      this.loginAttempts = 1;
      return;
    }

    this.loginAttempts += 1;

    // Lock account after 5 failed attempts
    if (this.loginAttempts >= 5 && !this.isLocked()) {
      this.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    }
  }

  async resetLoginAttempts(): Promise<void> {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    this.lastLoginAt = new Date();
  }
} 