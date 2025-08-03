import { ResolverData } from 'type-graphql';
import { CustomError } from './errorHandler';

export const AuthMiddleware = async ({ context }: ResolverData<any>) => {
  if (!context.user) {
    throw new CustomError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  }
};

// Optional auth middleware that doesn't throw errors if user is not authenticated
export const OptionalAuthMiddleware = async ({ context }: ResolverData<any>) => {
  // This middleware just passes through, allowing both authenticated and unauthenticated requests
  // The resolver can check context.user to see if user is authenticated
};

export const AdminMiddleware = async ({ context }: ResolverData<any>) => {
  if (!context.user) {
    throw new CustomError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  }
  
  if (context.user.role !== 'admin') {
    throw new CustomError('Admin access required', 403, 'ADMIN_ACCESS_REQUIRED');
  }
};

export const VerifiedUserMiddleware = async ({ context }: ResolverData<any>) => {
  if (!context.user) {
    throw new CustomError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  }
  
  if (!context.user.isVerified) {
    throw new CustomError('Account verification required', 403, 'VERIFICATION_REQUIRED');
  }
}; 