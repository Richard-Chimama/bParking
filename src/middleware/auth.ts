import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { CustomError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    phoneNumber: string;
    role: string;
    isVerified: boolean;
  };
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        phoneNumber: string;
        role: string;
        isVerified: boolean;
      };
    }
  }
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    logger.debug('Auth middleware processing request:', {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 10) + '...'
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Don't throw error for GraphQL introspection queries
      if (req.path === '/graphql' && req.method === 'POST') {
        logger.debug('No Bearer token found, proceeding without authentication');
        return next();
      }
      return next();
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      logger.debug('Empty token after Bearer prefix');
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      req.user = {
        id: decoded.id,
        email: decoded.email,
        phoneNumber: decoded.phoneNumber,
        role: decoded.role,
        isVerified: decoded.isVerified,
      };

      logger.info('User authenticated successfully:', { 
        userId: decoded.id, 
        role: decoded.role,
        email: decoded.email,
        isVerified: decoded.isVerified
      });
    } catch (jwtError: any) {
      logger.warn('Invalid JWT token:', { 
        token: token.substring(0, 10) + '...',
        error: jwtError.message 
      });
      // Don't throw error, just continue without user context
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    next();
  }
};

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  }
  next();
};

export const requireVerified = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  requireAuth(req, res, () => {
    if (!req.user?.isVerified) {
      throw new CustomError('Account verification required', 403, 'VERIFICATION_REQUIRED');
    }
    next();
  });
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      if (!req.user || !roles.includes(req.user.role)) {
        throw new CustomError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
      }
      next();
    });
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireUser = requireRole(['user', 'admin']); 