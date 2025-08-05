import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export class AddressType {
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
export class PreferencesType {
  @Field()
  notifications!: boolean;

  @Field()
  emailNotifications!: boolean;

  @Field()
  smsNotifications!: boolean;
}

@ObjectType()
export class UserType {
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
export class VehicleInfoType {
  @Field()
  licensePlate!: string;

  @Field()
  vehicleType!: string;

  @Field({ nullable: true })
  color?: string;

  @Field({ nullable: true })
  make?: string;

  @Field({ nullable: true })
  model?: string;
}

@ObjectType()
export class BookingType {
  @Field()
  id!: string;

  @Field()
  userId!: string;

  @Field()
  parkingId!: string;

  @Field()
  spaceId!: string;

  @Field()
  startTime!: Date;

  @Field()
  endTime!: Date;

  @Field()
  status!: string;

  @Field()
  totalAmount!: number;

  @Field()
  paymentStatus!: string;

  @Field({ nullable: true })
  paymentId?: string;

  @Field()
  bookingReference!: string;

  @Field(() => VehicleInfoType)
  vehicleInfo!: VehicleInfoType;

  @Field({ nullable: true })
  specialRequests?: string;

  @Field({ nullable: true })
  checkInTime?: Date;

  @Field({ nullable: true })
  checkOutTime?: Date;

  @Field()
  duration!: number;

  @Field()
  isActive!: boolean;

  @Field()
  canCheckIn!: boolean;

  @Field()
  canCheckOut!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class PaymentType {
  @Field()
  id!: string;

  @Field()
  bookingId!: string;

  @Field()
  userId!: string;

  @Field()
  amount!: number;

  @Field()
  currency!: string;

  @Field()
  transactionId!: string;

  @Field({ nullable: true })
  providerTransactionId?: string;

  @Field()
  status!: string;

  @Field({ nullable: true })
  paidAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class ParkingAddressType {
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
export class ParkingType {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  fullAddress!: string;

  @Field()
  totalSpaces!: number;

  @Field()
  availableSpaces!: number;

  @Field(() => [Number])
  coordinates!: number[];

  @Field(() => ParkingAddressType)
  address!: ParkingAddressType;

  @Field(() => [String], { nullable: true })
  availableSpaceIds?: string[];

  @Field()
  hourlyRate!: number;

  @Field()
  dailyRate!: number;

  @Field()
  currency!: string;

  @Field()
  isActive!: boolean;

  @Field()
  isVerified!: boolean;

  @Field()
  rating!: number;

  @Field()
  totalReviews!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}