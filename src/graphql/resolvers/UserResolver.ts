import { Resolver, Query, Mutation, Arg, Ctx, UseMiddleware } from 'type-graphql';
import { ObjectType, Field, InputType } from 'type-graphql';
import jwt from 'jsonwebtoken';
import { User } from '@/entities/User';
import { AppDataSource } from '@/database/connection';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { CustomError } from '@/middleware/errorHandler';
import { AuthMiddleware } from '@/middleware/graphqlAuth';
import { me as meFunction } from './UserResolver/me';
import { Context } from '@/type';

// GraphQL Types
@ObjectType()
class AddressType {
  @Field()
  street!: string;

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field()
  zipCode!: string;

  @Field()
  country!: string;
}

@ObjectType()
class PreferencesType {
  @Field()
  notifications!: boolean;

  @Field()
  emailNotifications!: boolean;

  @Field()
  smsNotifications!: boolean;
}

@ObjectType()
class UserType {
  @Field()
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field()
  phoneNumber!: string;

  @Field()
  role!: string;

  @Field()
  isVerified!: boolean;

  @Field()
  isActive!: boolean;

  @Field({ nullable: true })
  profilePicture?: string;

  @Field({ nullable: true })
  dateOfBirth?: Date;

  @Field(() => AddressType, { nullable: true })
  address?: AddressType;

  @Field(() => PreferencesType, { nullable: true })
  preferences?: PreferencesType;

  @Field({ nullable: true })
  lastLoginAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
class UserResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field({ nullable: true })
  token?: string;

  @Field(() => UserType, { nullable: true })
  user?: UserType;
}

// Input Types
@InputType()
class RegisterInput {
  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field()
  phoneNumber!: string;

  @Field()
  password!: string;
}

@InputType()
class LoginInput {
  @Field()
  phoneNumber!: string;

  @Field()
  password!: string;
}

@InputType()
class VerifyOTPInput {
  @Field()
    phoneNumber!: string;

  @Field()
  otpCode!: string;
}

@InputType()
class ResendOTPInput {
  @Field()
  phoneNumber!: string;
}

@Resolver()
export class UserResolver {
  @Query(() => UserType, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async me(@Ctx() ctx: Context): Promise<UserType | null> {
    return meFunction(ctx);
  }

  @Query(() => [UserType])
  @UseMiddleware(AuthMiddleware)
  async users(): Promise<UserType[]> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      const users = await userRepository.find({
        where: { isActive: true },
        select: [
          'id', 'firstName', 'lastName', 'email', 'phoneNumber', 
          'role', 'isVerified', 'isActive', 'profilePicture', 
          'dateOfBirth', 'address', 'preferences', 'lastLoginAt',
          'createdAt', 'updatedAt'
        ],
        order: { createdAt: 'DESC' }
      });
      logger.info(`Found ${users.length} active users in database`);
      return users.map(user => this.mapUserToType(user));
    } catch (error: any) {
      logger.error('Error fetching users:', error);
      throw error;
    }
  }

  @Mutation(() => UserResponse)
  async register(@Arg('input') input: RegisterInput): Promise<UserResponse> {
    try {
      // Validate input
      if (!input.firstName || !input.lastName || !input.email || !input.phoneNumber || !input.password) {
        throw new CustomError('All fields are required', 400, 'MISSING_FIELDS');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.email)) {
        throw new CustomError('Invalid email format', 400, 'INVALID_EMAIL');
      }

      // Validate phone number
      const sanitizedPhoneNumber = input.phoneNumber.trim();
      if (sanitizedPhoneNumber.length < 10) {
        throw new CustomError('Invalid phone number format', 400, 'INVALID_PHONE_NUMBER');
      }

      // Validate password strength
      if (input.password.length < 6) {
        throw new CustomError('Password must be at least 6 characters long', 400, 'WEAK_PASSWORD');
      }

      // Sanitize inputs
      const sanitizedInput = {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim().toLowerCase(),
        phoneNumber: sanitizedPhoneNumber,
        password: input.password
      };

      // Check if user already exists
      const userRepository = AppDataSource.getRepository(User);
      const existingUser = await userRepository.findOne({
        where: [
          { email: sanitizedInput.email },
          { phoneNumber: sanitizedInput.phoneNumber }
        ]
      });

      if (existingUser) {
        throw new CustomError(
          'User with this email or phone number already exists',
          409,
          'USER_ALREADY_EXISTS'
        );
      }

      // Create new user
      const user = new User();
      Object.assign(user, {
        ...sanitizedInput,
        role: 'user',
        isVerified: false,
      });

      // Generate OTP
      const otp = user.generateOTP();
      await userRepository.save(user);

      // TODO: Send OTP via SMS using Twilio
      logger.info(`OTP for ${input.phoneNumber}: ${otp}`);

      return {
        success: true,
        message: 'Registration successful. Please verify your phone number with the OTP sent to your phone.',
        user: this.mapUserToType(user),
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  @Mutation(() => UserResponse)
  async login(@Arg('input') input: LoginInput): Promise<UserResponse> {
    try {
      // Validate input
      if (!input.phoneNumber || !input.password) {
        throw new CustomError('Phone number and password are required', 400, 'MISSING_CREDENTIALS');
      }

      // Sanitize phone number
      const sanitizedPhoneNumber = input.phoneNumber.trim();
      if (sanitizedPhoneNumber.length < 10) {
        throw new CustomError('Invalid phone number format', 400, 'INVALID_PHONE_NUMBER');
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ 
        where: { phoneNumber: sanitizedPhoneNumber },
        select: [
          'id', 'firstName', 'lastName', 'email', 'phoneNumber', 
          'password', 'role', 'isVerified', 'isActive', 'loginAttempts', 
          'lockUntil', 'createdAt', 'updatedAt'
        ]
      });

      if (!user) {
        throw new CustomError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      if (!user.isActive) {
        throw new CustomError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
      }

      if (user.isLocked()) {
        throw new CustomError('Account is temporarily locked', 423, 'ACCOUNT_LOCKED');
      }

      const isPasswordValid = await user.comparePassword(input.password);

      if (!isPasswordValid) {
        await user.incrementLoginAttempts();
        throw new CustomError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Generate JWT token
      const token = (jwt as any).sign(
        {
          id: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isVerified: user.isVerified,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        success: true,
        message: 'Login successful',
        token,
        user: this.mapUserToType(user),
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  @Mutation(() => UserResponse)
  async verifyOTP(@Arg('input') input: VerifyOTPInput): Promise<UserResponse> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ 
        where: { phoneNumber: input.phoneNumber }
      });

      if (!user) {
        throw new CustomError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.isVerified) {
        throw new CustomError('User is already verified', 400, 'ALREADY_VERIFIED');
      }

      if (!user.otpCode || !user.otpExpiresAt) {
        throw new CustomError('No OTP found', 400, 'NO_OTP_FOUND');
      }

      if (user.otpExpiresAt < new Date()) {
        throw new CustomError('OTP has expired', 400, 'OTP_EXPIRED');
      }

      if (user.otpCode !== input.otpCode) {
        throw new CustomError('Invalid OTP', 400, 'INVALID_OTP');
      }

      // Verify user
      user.isVerified = true;
      user.otpCode = undefined;
      user.otpExpiresAt = undefined;
      await userRepository.save(user);

      // Generate JWT token
      const token = (jwt as any).sign(
        {
          id: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isVerified: user.isVerified,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        success: true,
        message: 'Phone number verified successfully',
        token,
        user: this.mapUserToType(user),
      };
    } catch (error) {
      logger.error('OTP verification error:', error);
      throw error;
    }
  }

  @Mutation(() => UserResponse)
  async resendOTP(@Arg('input') input: ResendOTPInput): Promise<UserResponse> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { phoneNumber: input.phoneNumber } });

      if (!user) {
        throw new CustomError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.isVerified) {
        throw new CustomError('User is already verified', 400, 'ALREADY_VERIFIED');
      }

      // Generate new OTP
      const otp = user.generateOTP();
      await userRepository.save(user);

      // TODO: Send OTP via SMS using Twilio
      logger.info(`New OTP for ${input.phoneNumber}: ${otp}`);

      return {
        success: true,
        message: 'OTP sent successfully',
      };
    } catch (error) {
      logger.error('Resend OTP error:', error);
      throw error;
    }
  }

  private mapUserToType(user: User): UserType {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      profilePicture: user.profilePicture,
      dateOfBirth: user.dateOfBirth,
      address: user.address ? {
        street: user.address.street,
        city: user.address.city,
        state: user.address.state,
        zipCode: user.address.zipCode,
        country: user.address.country,
      } : undefined,
      preferences: user.preferences ? {
        notifications: user.preferences.notifications,
        emailNotifications: user.preferences.emailNotifications,
        smsNotifications: user.preferences.smsNotifications,
      } : undefined,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}