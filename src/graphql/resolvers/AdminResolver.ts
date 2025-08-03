import { Resolver, Query, Mutation, Arg, Ctx, UseMiddleware } from 'type-graphql';
import { ObjectType, Field, InputType } from 'type-graphql';
import { User } from '@/entities/User';
import { Parking } from '@/entities/Parking';
import { AppDataSource } from '@/database/connection';
import { AdminMiddleware } from '@/middleware/graphqlAuth';

// Placeholder types - will be expanded later
@ObjectType()
class AdminResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
class DashboardStats {
  @Field()
  totalUsers!: number;

  @Field()
  totalParkings!: number;

  @Field()
  totalRevenue!: number;

  @Field()
  activeBookings!: number;
}

@ObjectType()
class AdminUserType {
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

  @Field()
  createdAt!: Date;
}

@ObjectType()
class AdminAddressType {
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
class AdminParkingType {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  totalSpaces!: number;

  @Field()
  availableSpaces!: number;

  @Field(() => [Number])
  coordinates!: number[];

  @Field(() => AdminAddressType)
  address!: AdminAddressType;

  @Field()
  isActive!: boolean;

  @Field()
  isVerified!: boolean;

  @Field(() => AdminUserType, { nullable: true })
  owner?: AdminUserType;

  @Field()
  createdAt!: Date;
}

@InputType()
class UpdateUserStatusInput {
  @Field()
  userId!: string;

  @Field()
  isActive!: boolean;
}

@InputType()
class UpdateParkingStatusInput {
  @Field()
  parkingId!: string;

  @Field()
  isVerified!: boolean;
}

interface Context {
  user?: {
    id: string;
    email: string;
    phoneNumber: string;
    role: string;
    isVerified: boolean;
  };
}

@Resolver()
export class AdminResolver {
  @Query(() => DashboardStats)
  @UseMiddleware(AdminMiddleware)
  async dashboardStats(): Promise<DashboardStats> {
    const userRepository = AppDataSource.getRepository(User);
    const parkingRepository = AppDataSource.getRepository(Parking);
    
    const totalUsers = await userRepository.count({ where: { isActive: true } });
    const totalParkings = await parkingRepository.count({ where: { isActive: true } });
    
    return {
      totalUsers,
      totalParkings,
      totalRevenue: 0, // TODO: Calculate from payments
      activeBookings: 0, // TODO: Calculate from bookings
    };
  }

  @Query(() => [AdminUserType])
  @UseMiddleware(AdminMiddleware)
  async allUsers(): Promise<AdminUserType[]> {
    const userRepository = AppDataSource.getRepository(User);
    const users = await userRepository.find({ 
      order: { createdAt: 'DESC' } 
    });
    return users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
    }));
  }

  @Query(() => [AdminParkingType])
  @UseMiddleware(AdminMiddleware)
  async allParkings(): Promise<AdminParkingType[]> {
    const parkingRepository = AppDataSource.getRepository(Parking);
    const parkings = await parkingRepository.find({ 
      relations: ['owner'],
      order: { createdAt: 'DESC' } 
    });
    return parkings.map(parking => ({
      id: parking.id,
      name: parking.name,
      description: parking.description,
      totalSpaces: parking.totalSpaces,
      availableSpaces: parking.availableSpaces,
      coordinates: parking.location.coordinates,
      address: parking.address,
      isActive: parking.isActive,
      isVerified: parking.isVerified,
      owner: parking.owner ? {
        id: parking.owner.id,
        firstName: parking.owner.firstName,
        lastName: parking.owner.lastName,
        email: parking.owner.email,
        phoneNumber: parking.owner.phoneNumber,
        role: parking.owner.role,
        isVerified: parking.owner.isVerified,
        isActive: parking.owner.isActive,
        createdAt: parking.owner.createdAt,
      } : undefined,
      createdAt: parking.createdAt,
    }));
  }

  @Mutation(() => AdminResponse)
  @UseMiddleware(AdminMiddleware)
  async updateUserStatus(@Arg('input') input: UpdateUserStatusInput): Promise<AdminResponse> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      await userRepository.update(input.userId, { isActive: input.isActive });
      
      return {
        success: true,
        message: `User ${input.isActive ? 'activated' : 'deactivated'} successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update user status',
      };
    }
  }

  @Mutation(() => AdminResponse)
  @UseMiddleware(AdminMiddleware)
  async updateParkingStatus(@Arg('input') input: UpdateParkingStatusInput): Promise<AdminResponse> {
    try {
      const parkingRepository = AppDataSource.getRepository(Parking);
      await parkingRepository.update(input.parkingId, { isVerified: input.isVerified });
      
      return {
        success: true,
        message: `Parking ${input.isVerified ? 'verified' : 'unverified'} successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update parking status',
      };
    }
  }

  @Mutation(() => AdminResponse)
  @UseMiddleware(AdminMiddleware)
  async deleteUser(@Arg('userId') userId: string): Promise<AdminResponse> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      await userRepository.delete(userId);
      
      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete user',
      };
    }
  }

  @Mutation(() => AdminResponse)
  @UseMiddleware(AdminMiddleware)
  async deleteParking(@Arg('parkingId') parkingId: string): Promise<AdminResponse> {
    try {
      const parkingRepository = AppDataSource.getRepository(Parking);
      await parkingRepository.delete(parkingId);
      
      return {
        success: true,
        message: 'Parking deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete parking',
      };
    }
  }
} 