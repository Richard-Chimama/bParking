import { ResolverData } from 'type-graphql';
import { CustomError } from './errorHandler';
import { logger } from '@/utils/logger';

export const AuthMiddleware = async ({ context }: ResolverData<any>, next: Function) => {
  if (!context.user) {
    logger.warn('Authentication required - no user in context');
    throw new CustomError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  }
  
  // Call next() to continue to the resolver
  return next();
};

// Optional auth middleware that doesn't throw errors if user is not authenticated
export const OptionalAuthMiddleware = async ({ context }: ResolverData<any>, next: Function) => {
  // This middleware just passes through, allowing both authenticated and unauthenticated requests
  // The resolver can check context.user to see if user is authenticated
  return next();
};

export const AdminMiddleware = async ({ context }: ResolverData<any>, next: Function) => {
  if (!context.user) {
    throw new CustomError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  }
  
  if (context.user.role !== 'admin') {
    throw new CustomError('Admin access required', 403, 'ADMIN_ACCESS_REQUIRED');
  }
  
  return next();
};

export const VerifiedUserMiddleware = async ({ context }: ResolverData<any>, next: Function) => {
  if (!context.user) {
    throw new CustomError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  }
  
  if (!context.user.isVerified) {
    throw new CustomError('Account verification required', 403, 'VERIFICATION_REQUIRED');
  }
  
  return next();
};