import { User } from '@/entities/User';
import { AppDataSource } from '@/database/connection';
import { logger } from '@/utils/logger';
import { UserType, Context } from '@/type';

// Helper function to map User entity to UserType
function mapUserToType(user: User): UserType {
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
    address: user.address,
    preferences: user.preferences,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function me(ctx: Context): Promise<UserType | null> {
    try {
      logger.info('Me resolver called with context:', {
        hasUser: !!ctx.user,
        userId: ctx.user?.id,
        userEmail: ctx.user?.email,
        userRole: ctx.user?.role,
        isVerified: ctx.user?.isVerified
      });

      if (!ctx.user) {
        logger.warn('No user in context for me query');
        return null;
      }

      logger.info('Looking up user for me query:', { userId: ctx.user.id });
      const userRepository = AppDataSource.getRepository(User);
      
      // Use findOne with explicit field selection
      const user = await userRepository.findOne({ 
        where: { id: ctx.user.id },
        select: [
          'id', 'firstName', 'lastName', 'email', 'phoneNumber', 
          'role', 'isVerified', 'isActive', 'profilePicture', 
          'dateOfBirth', 'address', 'preferences', 'lastLoginAt',
          'createdAt', 'updatedAt'
        ]
      });

      if (!user) {
        logger.warn('User not found in database:', { userId: ctx.user.id });
        return null;
      }

      logger.info('User found for me query:', { userId: user.id, email: user.email });
      return mapUserToType(user);
    } catch (error: any) {
      logger.error('Error in me query:', error);
      throw error;
    }
  }