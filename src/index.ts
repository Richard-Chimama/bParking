import 'reflect-metadata';
import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

import { config } from '@/config';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { authMiddleware } from '@/middleware/auth';
import { graphqlDebugMiddleware } from '@/middleware/graphqlDebug';
import { connectDatabase } from '@/database/connection';
import { UserResolver } from '@/graphql/resolvers/UserResolver';
import { ParkingResolver } from '@/graphql/resolvers/ParkingResolver';
import { PaymentResolver } from '@/graphql/resolvers/PaymentResolver';
import { BookingResolver } from '@/graphql/resolvers/BookingResolver';
import { AdminResolver } from '@/graphql/resolvers/AdminResolver';
import { WaitlistResolver } from '@/graphql/resolvers/WaitlistResolver';
import { RecurringBookingResolver } from '@/graphql/resolvers/RecurringBookingResolver';
import { NotificationResolver } from '@/graphql/resolvers/NotificationResolver';
import healthRoutes from '@/routes/health';
import { memoryMonitor } from '@/utils/memoryMonitor';
import WebSocketService from '@/services/websocket';
import NotificationService from '@/services/notification';
import SchedulerService from '@/services/scheduler';
import '@/config/firebase';

// Load environment variables
dotenv.config();

async function startServer() {
  try {
    // Initialize Firebase (imported automatically)
    logger.info('Firebase initialized successfully');

    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Create Express app and HTTP server
    const app = express();
    const httpServer = createServer(app);

    // Initialize services
    const notificationService = new NotificationService();
    const webSocketService = new WebSocketService(httpServer);
    const schedulerService = new SchedulerService(notificationService, webSocketService);

    // Start scheduler
    schedulerService.start();
    logger.info('Scheduler service started');

    // Security middleware
    app.use(helmet());
    app.use(
      cors({
        origin: config.cors.origin,
        credentials: true,
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: 'Too many requests from this IP, please try again later.',
    });
    app.use('/api/', limiter);

    // Speed limiting
    const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 100, // allow 100 requests per 15 minutes, then...
      delayMs: () => 500, // begin adding 500ms of delay per request above 100
    });
    app.use('/api/', speedLimiter);

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression middleware
    app.use(compression());

    // Static file serving for test pages
    app.use(express.static('public'));

    // Authentication middleware
    app.use(authMiddleware);

    // GraphQL debug middleware (only in development)
    if (config.nodeEnv === 'development') {
      app.use(graphqlDebugMiddleware);
    }

    // Health check routes
    app.use('/health', healthRoutes);
    
    // Legacy health check endpoint (for backward compatibility)
    app.get('/health-simple', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // GraphQL test page
    app.get('/test', (req, res) => {
      res.sendFile('graphql-test.html', { root: './public' });
    });

    // Simple GraphQL Playground endpoint
    app.get('/playground', (req, res) => {
      res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>bParking GraphQL Playground</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        h1 { color: #333; text-align: center; }
                        .endpoint { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .endpoint h3 { margin-top: 0; color: #007bff; }
                        .code { background: #e9ecef; padding: 10px; border-radius: 3px; font-family: monospace; margin: 10px 0; }
                        .example { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .example h4 { margin-top: 0; color: #155724; }
                        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .warning h4 { margin-top: 0; color: #856404; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🚗 bParking GraphQL API</h1>
                        
                        <div class="endpoint">
                            <h3>GraphQL Endpoint</h3>
                            <div class="code">POST http://localhost:4000/graphql</div>
                        </div>

                        <div class="warning">
                            <h4>⚠️ Apollo Playground Issue</h4>
                            <p>The Apollo Playground at <a href="/graphql" target="_blank">/graphql</a> might not load due to external CDN dependencies. You can use any GraphQL client like:</p>
                            <ul>
                                <li><a href="https://insomnia.rest/" target="_blank">Insomnia</a></li>
                                <li><a href="https://www.postman.com/" target="_blank">Postman</a></li>
                                <li><a href="https://github.com/graphql/graphiql" target="_blank">GraphiQL</a></li>
                            </ul>
                        </div>

                        <div class="example">
                            <h4>📝 Example Queries</h4>
                            
                            <h5>Register a new user:</h5>
                            <div class="code">
                mutation {
                  register(input: {
                    firstName: "John"
                    lastName: "Doe"
                    email: "john@example.com"
                    phoneNumber: "+260977123456"
                    password: "password123"
                  }) {
                    success
                    message
                    user {
                      id
                      firstName
                      lastName
                      email
                      phoneNumber
                      role
                      isVerified
                    }
                  }
                }
                            </div>

                            <h5>Login:</h5>
                            <div class="code">
                mutation {
                  login(input: {
                    phoneNumber: "+260977123456"
                    password: "password123"
                  }) {
                    success
                    message
                    token
                    user {
                      id
                      firstName
                      lastName
                      email
                      phoneNumber
                      role
                      isVerified
                    }
                  }
                }
                            </div>

                            <h5>Get current user (requires authentication):</h5>
                            <div class="code">
                query {
                  me {
                    id
                    firstName
                    lastName
                    email
                    phoneNumber
                    role
                    isVerified
                    isActive
                    createdAt
                  }
                }
                            </div>
                        </div>

                        <div class="endpoint">
                            <h3>🔧 Other Endpoints</h3>
                            <ul>
                                <li><strong>Health Check:</strong> <a href="/health" target="_blank">GET /health</a></li>
                                <li><strong>GraphQL:</strong> <a href="/graphql" target="_blank">POST /graphql</a></li>
                            </ul>
                        </div>
                    </div>
                </body>
                </html>
      `);
    });

    // Build GraphQL schema
    const schema = await buildSchema({
      resolvers: [
        UserResolver,
        ParkingResolver,
        PaymentResolver,
        BookingResolver,
        AdminResolver,
        WaitlistResolver,
        RecurringBookingResolver,
        NotificationResolver,
      ],
      validate: false,
      authChecker: ({ context }) => {
        return !!context.user;
      },
    });

    // Create Apollo Server
    const apolloServer = new ApolloServer({
      schema,
      context: ({ req }) => {
        let user = null;
        
        // Extract and verify JWT token directly in GraphQL context
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = jwt.verify(token, config.jwt.secret) as any;
            user = {
              id: decoded.id,
              email: decoded.email,
              phoneNumber: decoded.phoneNumber,
              role: decoded.role,
              isVerified: decoded.isVerified,
            };
            logger.info('GraphQL context user authenticated:', {
              userId: user.id,
              email: user.email,
              role: user.role
            });
          } catch (jwtError: any) {
            logger.info('Invalid JWT token in GraphQL context:', {
              error: jwtError.message
            });
          }
        }
        
        logger.info('Creating GraphQL context:', {
          hasUser: !!user,
          userId: user?.id,
          userEmail: user?.email,
          userRole: user?.role
        });
        
        return {
          user,
          // Only include specific properties from req to avoid circular references
          requestInfo: {
            headers: req.headers,
            method: req.method,
            url: req.url,
            ip: req.ip,
          },
          // Add services to context
          notificationService,
          webSocketService,
        };
      },
      introspection: config.nodeEnv === 'development',
      formatError: error => {
        logger.error('GraphQL Error:', {
          message: error.message,
          code: error.extensions?.code,
          path: error.path,
          originalError: error.originalError,
        });
        return {
          message: error.message,
          code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
        };
      },
      plugins: [
        {
          requestDidStart: async requestContext => {
            logger.info('GraphQL Request Started:', {
              operationName: requestContext.request.operationName,
              query: requestContext.request.query?.substring(0, 100) + '...',
            });
          },
        },
      ],
    });

    await apolloServer.start();

    // Apply Apollo middleware
    apolloServer.applyMiddleware({
      app: app as any,
      path: '/graphql',
      cors: {
        origin: config.cors.origin,
        credentials: true,
      },
    });

    // Error handling middleware
    app.use(errorHandler);

    // Start memory monitoring
    memoryMonitor.startMonitoring(60000); // Monitor every minute
    logger.info('🧠 Memory monitoring started');

    // Start server
    const port = config.port;
    httpServer.listen(port, () => {
      logger.info(`🚀 Server running on port ${port}`);
      logger.info(`📊 GraphQL endpoint: http://localhost:${port}/graphql`);
      logger.info(`🧪 GraphQL Test Page: http://localhost:${port}/test`);
      logger.info(`🔍 Custom Playground: http://localhost:${port}/playground`);
      logger.info(`🏥 Health check: http://localhost:${port}/health`);
      logger.info(`🔌 WebSocket server ready at ws://localhost:${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      schedulerService.stop();
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      schedulerService.stop();
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
