import { Resolver, Query, Mutation, Arg, UseMiddleware, Ctx, ObjectType, Field, InputType, FieldResolver, Root, Int } from 'type-graphql';
import { AuthMiddleware, VerifiedUserMiddleware } from '../../middleware/graphqlAuth';
import { Payment, PaymentMethod, PaymentStatus, PaymentProvider } from '../../entities/Payment';
import { Booking, PaymentStatus as BookingPaymentStatus } from '../../entities/Booking';
import { User } from '../../entities/User';
import { AppDataSource } from '../../database/connection';
import { logger } from '../../utils/logger';
import { UserType, BookingType, PaymentType } from '../types/shared';

@ObjectType()
class PaymentResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field({ nullable: true })
  transactionId?: string;

  @Field(() => PaymentType, { nullable: true })
  payment?: PaymentType;

  @Field({ nullable: true })
  paymentUrl?: string; // For mobile money redirect URLs

  @Field({ nullable: true })
  qrCode?: string; // For QR code payments
}

@ObjectType()
class MobileMoneyResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field({ nullable: true })
  transactionId?: string;

  @Field({ nullable: true })
  paymentUrl?: string;

  @Field({ nullable: true })
  ussdCode?: string;

  @Field({ nullable: true })
  instructions?: string;
}

@InputType()
class CreatePaymentInput {
  @Field()
  bookingId!: string;

  @Field()
  paymentMethod!: PaymentMethod;

  @Field({ nullable: true })
  phoneNumber?: string; // Required for mobile money

  @Field({ nullable: true })
  returnUrl?: string; // For web redirects
}

@InputType()
class VerifyPaymentInput {
  @Field()
  transactionId!: string;

  @Field({ nullable: true })
  providerTransactionId?: string;
}

interface Context {
  user?: {
    id: string;
    email: string;
    phoneNumber: string;
    role: string;
    isVerified: boolean;
  };
  requestInfo?: {
    headers: any;
    method: string;
    url: string;
    ip: string;
  };
}

@Resolver(() => PaymentType)
export class PaymentResolver {
  // Field Resolvers
  @FieldResolver(() => UserType)
  async user(@Root() payment: Payment): Promise<UserType> {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOneByOrFail({ id: payment.userId });
    return this.mapUserToType(user);
  }

  @FieldResolver(() => BookingType)
  async booking(@Root() payment: Payment): Promise<BookingType> {
    const bookingRepository = AppDataSource.getRepository(Booking);
    const booking = await bookingRepository.findOneByOrFail({ id: payment.bookingId });
    return this.mapBookingToType(booking);
  }

  // Queries
  @Query(() => [PaymentType])
  @UseMiddleware(AuthMiddleware)
  async myPayments(
    @Arg('limit', () => Int, { defaultValue: 20 }) limit: number,
    @Arg('offset', () => Int, { defaultValue: 0 }) offset: number,
    @Ctx() ctx: Context
  ): Promise<PaymentType[]> {
    const paymentRepository = AppDataSource.getRepository(Payment);
    
    return await paymentRepository.find({
      where: { userId: ctx.user!.id },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset
    });
  }

  @Query(() => PaymentType, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async payment(
    @Arg('transactionId') transactionId: string,
    @Ctx() ctx: Context
  ): Promise<PaymentType | null> {
    const paymentRepository = AppDataSource.getRepository(Payment);
    
    return await paymentRepository.findOneBy({
      transactionId,
      userId: ctx.user!.id
    });
  }

  // Mutations
  @Mutation(() => PaymentResponse)
  @UseMiddleware(VerifiedUserMiddleware)
  async createPayment(@Arg('input') input: CreatePaymentInput, @Ctx() ctx: Context): Promise<PaymentResponse> {
    const paymentRepository = AppDataSource.getRepository(Payment);
    const bookingRepository = AppDataSource.getRepository(Booking);

    try {
      // Validate booking
      const booking = await bookingRepository.findOneBy({
        id: input.bookingId,
        userId: ctx.user!.id
      });

      if (!booking) {
        return {
          success: false,
          message: 'Booking not found'
        };
      }

      if (booking.paymentStatus === 'paid') {
        return {
          success: false,
          message: 'Booking is already paid'
        };
      }

      // Validate mobile money phone number
      if ([PaymentMethod.MTN_MOBILE_MONEY, PaymentMethod.AIRTEL_MONEY, PaymentMethod.ZAMTEL_KWACHA].includes(input.paymentMethod)) {
        if (!input.phoneNumber) {
          return {
            success: false,
            message: 'Phone number is required for mobile money payments'
          };
        }
      }

      // Create payment record
      const transactionId = Payment.generateTransactionId();
      const provider = Payment.getProviderForPaymentMethod(input.paymentMethod);
      const expiresAt = Payment.calculateExpiryTime(input.paymentMethod);

      const payment = paymentRepository.create({
        bookingId: input.bookingId,
        userId: ctx.user!.id,
        amount: booking.totalAmount,
        currency: 'ZMW',
        paymentMethod: input.paymentMethod,
        provider,
        transactionId,
        status: PaymentStatus.PENDING,
        expiresAt,
        paymentDetails: input.phoneNumber ? { phoneNumber: input.phoneNumber } : undefined
      });

      const savedPayment = await paymentRepository.save(payment);

      // Process payment based on method
      let paymentResponse: any = {};
      
      switch (input.paymentMethod) {
        case PaymentMethod.MTN_MOBILE_MONEY:
          paymentResponse = await this.processMTNPayment(savedPayment, input.phoneNumber!);
          break;
        case PaymentMethod.AIRTEL_MONEY:
          paymentResponse = await this.processAirtelPayment(savedPayment, input.phoneNumber!);
          break;
        case PaymentMethod.ZAMTEL_KWACHA:
          paymentResponse = await this.processZamtelPayment(savedPayment, input.phoneNumber!);
          break;
        default:
          paymentResponse = {
            success: true,
            message: 'Payment initiated. Please complete payment manually.',
            instructions: 'Contact support for payment completion.'
          };
      }

      // Update payment with provider response
      if (paymentResponse.providerTransactionId) {
        savedPayment.providerTransactionId = paymentResponse.providerTransactionId;
        savedPayment.status = PaymentStatus.PROCESSING;
        await paymentRepository.save(savedPayment);
      }

      logger.info(`Payment initiated: ${transactionId} for booking ${input.bookingId}`);

      return {
        success: true,
        message: paymentResponse.message || 'Payment initiated successfully',
        transactionId,
        payment: savedPayment,
        paymentUrl: paymentResponse.paymentUrl,
        qrCode: paymentResponse.qrCode
      };
    } catch (error) {
      logger.error('Error creating payment:', error);
      return {
        success: false,
        message: 'Failed to initiate payment. Please try again.'
      };
    }
  }

  @Mutation(() => PaymentResponse)
  @UseMiddleware(VerifiedUserMiddleware)
  async verifyPayment(@Arg('input') input: VerifyPaymentInput): Promise<PaymentResponse> {
    const paymentRepository = AppDataSource.getRepository(Payment);
    const bookingRepository = AppDataSource.getRepository(Booking);

    try {
      const payment = await paymentRepository.findOneBy({
        transactionId: input.transactionId
      });

      if (!payment) {
        return {
          success: false,
          message: 'Payment not found'
        };
      }

      if (payment.isCompleted) {
        return {
          success: true,
          message: 'Payment already verified',
          payment
        };
      }

      // Verify with provider based on payment method
      let verificationResult: any = {};
      
      switch (payment.paymentMethod) {
        case PaymentMethod.MTN_MOBILE_MONEY:
          verificationResult = await this.verifyMTNPayment(payment);
          break;
        case PaymentMethod.AIRTEL_MONEY:
          verificationResult = await this.verifyAirtelPayment(payment);
          break;
        case PaymentMethod.ZAMTEL_KWACHA:
          verificationResult = await this.verifyZamtelPayment(payment);
          break;
        default:
          verificationResult = { success: false, message: 'Manual verification required' };
      }

      if (verificationResult.success) {
        // Mark payment as completed
        payment.markAsCompleted(verificationResult.providerTransactionId, verificationResult.providerResponse);
        await paymentRepository.save(payment);

        // Update booking payment status
        const booking = await bookingRepository.findOneByOrFail({ id: payment.bookingId });
        booking.paymentStatus = BookingPaymentStatus.PAID;
        booking.paymentId = payment.id;
        await bookingRepository.save(booking);

        logger.info(`Payment verified: ${payment.transactionId}`);

        return {
          success: true,
          message: 'Payment verified successfully',
          payment
        };
      } else {
        // Mark payment as failed if verification failed
        payment.markAsFailed(verificationResult.message || 'Verification failed');
        await paymentRepository.save(payment);

        return {
          success: false,
          message: verificationResult.message || 'Payment verification failed'
        };
      }
    } catch (error) {
      logger.error('Error verifying payment:', error);
      return {
        success: false,
        message: 'Failed to verify payment. Please try again.'
      };
    }
  }

  @Mutation(() => PaymentResponse)
  @UseMiddleware(VerifiedUserMiddleware)
  async retryPayment(@Arg('transactionId') transactionId: string): Promise<PaymentResponse> {
    const paymentRepository = AppDataSource.getRepository(Payment);

    try {
      const payment = await paymentRepository.findOneBy({ transactionId });

      if (!payment) {
        return {
          success: false,
          message: 'Payment not found'
        };
      }

      if (!payment.canBeRetried) {
        return {
          success: false,
          message: 'Payment cannot be retried'
        };
      }

      payment.incrementRetryCount();
      payment.status = PaymentStatus.PENDING;
      payment.failureReason = undefined;
      
      await paymentRepository.save(payment);

      logger.info(`Payment retry initiated: ${transactionId}`);

      return {
        success: true,
        message: 'Payment retry initiated',
        payment
      };
    } catch (error) {
      logger.error('Error retrying payment:', error);
      return {
        success: false,
        message: 'Failed to retry payment'
      };
    }
  }

  // Private methods for payment provider integration
  private async processMTNPayment(payment: Payment, phoneNumber: string): Promise<any> {
    // TODO: Integrate with MTN Mobile Money API
    // This is a placeholder implementation
    logger.info(`Processing MTN payment for ${payment.transactionId}`);
    
    return {
      success: true,
      message: 'MTN Mobile Money payment initiated. Please check your phone for the payment prompt.',
      providerTransactionId: `MTN_${Date.now()}`,
      ussdCode: '*303#',
      instructions: 'Dial *303# and follow the prompts to complete your payment'
    };
  }

  private async processAirtelPayment(payment: Payment, phoneNumber: string): Promise<any> {
    // TODO: Integrate with Airtel Money API
    logger.info(`Processing Airtel payment for ${payment.transactionId}`);
    
    return {
      success: true,
      message: 'Airtel Money payment initiated. Please check your phone for the payment prompt.',
      providerTransactionId: `AIRTEL_${Date.now()}`,
      ussdCode: '*778#',
      instructions: 'Dial *778# and follow the prompts to complete your payment'
    };
  }

  private async processZamtelPayment(payment: Payment, phoneNumber: string): Promise<any> {
    // TODO: Integrate with Zamtel Kwacha API
    logger.info(`Processing Zamtel payment for ${payment.transactionId}`);
    
    return {
      success: true,
      message: 'Zamtel Kwacha payment initiated. Please check your phone for the payment prompt.',
      providerTransactionId: `ZAMTEL_${Date.now()}`,
      ussdCode: '*456#',
      instructions: 'Dial *456# and follow the prompts to complete your payment'
    };
  }

  private async verifyMTNPayment(payment: Payment): Promise<any> {
    // TODO: Implement MTN payment verification
    logger.info(`Verifying MTN payment for ${payment.transactionId}`);
    
    // Placeholder - in real implementation, call MTN API
    return {
      success: true,
      providerTransactionId: payment.providerTransactionId,
      providerResponse: { status: 'SUCCESSFUL', timestamp: new Date().toISOString() }
    };
  }

  private async verifyAirtelPayment(payment: Payment): Promise<any> {
    // TODO: Implement Airtel payment verification
    logger.info(`Verifying Airtel payment for ${payment.transactionId}`);
    
    return {
      success: true,
      providerTransactionId: payment.providerTransactionId,
      providerResponse: { status: 'SUCCESSFUL', timestamp: new Date().toISOString() }
    };
  }

  private async verifyZamtelPayment(payment: Payment): Promise<any> {
    // TODO: Implement Zamtel payment verification
    logger.info(`Verifying Zamtel payment for ${payment.transactionId}`);
    
    return {
      success: true,
      providerTransactionId: payment.providerTransactionId,
      providerResponse: { status: 'SUCCESSFUL', timestamp: new Date().toISOString() }
    };
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  private mapBookingToType(booking: Booking): BookingType {
    return {
      id: booking.id,
      userId: booking.userId,
      parkingId: booking.parkingId,
      spaceId: booking.spaceId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      totalAmount: booking.totalAmount,
      paymentStatus: booking.paymentStatus,
      paymentId: booking.paymentId,
      bookingReference: booking.bookingReference,
      vehicleInfo: {
        licensePlate: booking.vehicleInfo.licensePlate,
        vehicleType: booking.vehicleInfo.vehicleType,
        color: booking.vehicleInfo.color,
        make: booking.vehicleInfo.make,
        model: booking.vehicleInfo.model
      },
      specialRequests: booking.specialRequests,
      checkInTime: booking.checkInTime,
      checkOutTime: booking.checkOutTime,
      duration: booking.duration,
      isActive: booking.isActive,
      canCheckIn: booking.canCheckIn,
      canCheckOut: booking.canCheckOut,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    };
  }
}