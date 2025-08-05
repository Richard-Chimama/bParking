import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppDataSource } from '../database/connection';
import { User } from '../entities/User';
import { Booking } from '../entities/Booking';
import { Parking } from '../entities/Parking';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as any;
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id: decoded.userId } });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.userRole = user.role;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.userId} connected`);
      
      // Store user connection
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);
      }

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Handle parking availability subscription
      socket.on('subscribe:parking', (parkingId: string) => {
        socket.join(`parking:${parkingId}`);
        console.log(`User ${socket.userId} subscribed to parking ${parkingId}`);
      });

      // Handle parking availability unsubscription
      socket.on('unsubscribe:parking', (parkingId: string) => {
        socket.leave(`parking:${parkingId}`);
        console.log(`User ${socket.userId} unsubscribed from parking ${parkingId}`);
      });

      // Handle booking status subscription
      socket.on('subscribe:booking', (bookingId: string) => {
        socket.join(`booking:${bookingId}`);
        console.log(`User ${socket.userId} subscribed to booking ${bookingId}`);
      });

      // Handle location-based parking subscription
      socket.on('subscribe:location', (data: { latitude: number; longitude: number; radius: number }) => {
        socket.join(`location:${data.latitude}:${data.longitude}:${data.radius}`);
        console.log(`User ${socket.userId} subscribed to location updates`);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
        }
      });
    });
  }

  // Emit parking availability update
  public emitParkingAvailabilityUpdate(parkingId: string, availableSpaces: number, totalSpaces: number) {
    this.io.to(`parking:${parkingId}`).emit('parking:availability:update', {
      parkingId,
      availableSpaces,
      totalSpaces,
      timestamp: new Date().toISOString()
    });
  }

  // Emit booking status update
  public emitBookingStatusUpdate(bookingId: string, status: string, userId: string) {
    // Emit to specific user
    this.io.to(`user:${userId}`).emit('booking:status:update', {
      bookingId,
      status,
      timestamp: new Date().toISOString()
    });

    // Emit to booking subscribers
    this.io.to(`booking:${bookingId}`).emit('booking:status:update', {
      bookingId,
      status,
      timestamp: new Date().toISOString()
    });
  }

  // Emit payment status update
  public emitPaymentStatusUpdate(userId: string, paymentId: string, status: string, bookingId?: string) {
    this.io.to(`user:${userId}`).emit('payment:status:update', {
      paymentId,
      status,
      bookingId,
      timestamp: new Date().toISOString()
    });
  }

  // Emit notification to user
  public emitNotification(userId: string, notification: {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    data?: any;
  }) {
    this.io.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });
  }

  // Emit waitlist update
  public emitWaitlistUpdate(parkingId: string, position: number, userId: string) {
    this.io.to(`user:${userId}`).emit('waitlist:position:update', {
      parkingId,
      position,
      timestamp: new Date().toISOString()
    });
  }

  // Emit waitlist availability notification
  public emitWaitlistAvailability(userId: string, parkingId: string, availableUntil: Date) {
    this.io.to(`user:${userId}`).emit('waitlist:availability', {
      parkingId,
      availableUntil: availableUntil.toISOString(),
      timestamp: new Date().toISOString()
    });
  }

  // Get connected users count
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Check if user is connected
  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get socket instance for advanced operations
  public getIO(): SocketIOServer {
    return this.io;
  }
}

export default WebSocketService;