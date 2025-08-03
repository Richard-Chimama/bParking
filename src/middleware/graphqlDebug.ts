import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

export const graphqlDebugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Only log for GraphQL requests
  if (req.path === '/graphql') {
    logger.info('GraphQL Request Debug:', {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? 'present' : 'missing',
      },
      body: req.body,
      query: req.query,
    });

    // Check if the request body is empty or malformed
    if (!req.body || Object.keys(req.body).length === 0) {
      logger.warn('Empty GraphQL request body detected');
    }

    if (req.body && !req.body.query && !req.body.operationName) {
      logger.warn('GraphQL request missing query and operationName');
    }
  }

  next();
}; 