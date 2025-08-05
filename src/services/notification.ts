import { firebaseMessaging } from '../config/firebase';
import { AppDataSource } from '../database/connection';
import { User } from '../entities/User';
import WebSocketService from './websocket';

export interface NotificationData {
  title: string;
  body: string;
  type: 'booking' | 'payment' | 'waitlist' | 'general';
  data?: Record<string, any>;
  imageUrl?: string;
}

export interface PushNotificationPayload {
  token: string;
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  };
  data?: Record<string, string>;
  android?: {
    priority: 'high' | 'normal';
    notification: {
      sound: string;
      channelId: string;
      priority: 'high' | 'low' | 'default' | 'max' | 'min';
    };
  };
  apns?: {
    payload: {
      aps: {
        sound: string;
        badge?: number;
        'content-available'?: number;
      };
    };
  };
}

class NotificationService {
  private webSocketService?: WebSocketService;

  constructor(webSocketService?: WebSocketService) {
    this.webSocketService = webSocketService;
  }

  // Send push notification via Firebase
  async sendPushNotification(userId: string, notificationData: NotificationData): Promise<boolean> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: userId } });

      if (!user || !user.fcmToken) {
        console.log(`No FCM token found for user ${userId}`);
        return false;
      }

      const payload: PushNotificationPayload = {
        token: user.fcmToken,
        notification: {
          title: notificationData.title,
          body: notificationData.body,
          imageUrl: notificationData.imageUrl
        },
        data: notificationData.data ? this.convertDataToStrings(notificationData.data) : undefined,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'bparking_notifications',
            priority: 'high'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              'content-available': 1
            }
          }
        }
      };

      const response = await firebaseMessaging.send(payload);
      console.log('Push notification sent successfully:', response);
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  // Send real-time notification via WebSocket
  async sendRealtimeNotification(userId: string, notificationData: NotificationData): Promise<void> {
    if (this.webSocketService) {
      this.webSocketService.emitNotification(userId, {
        id: this.generateNotificationId(),
        title: notificationData.title,
        message: notificationData.body,
        type: this.mapNotificationType(notificationData.type),
        data: notificationData.data
      });
    }
  }

  // Send both push and real-time notification
  async sendNotification(userId: string, notificationData: NotificationData): Promise<void> {
    await Promise.all([
      this.sendPushNotification(userId, notificationData),
      this.sendRealtimeNotification(userId, notificationData)
    ]);
  }

  // Send booking confirmation notification
  async sendBookingConfirmation(userId: string, bookingReference: string, parkingName: string, startTime: Date): Promise<void> {
    const notificationData: NotificationData = {
      title: 'Booking Confirmed! 🎉',
      body: `Your parking at ${parkingName} is confirmed for ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString()}`,
      type: 'booking',
      data: {
        bookingReference,
        parkingName,
        startTime: startTime.toISOString(),
        action: 'booking_confirmed'
      }
    };

    await this.sendNotification(userId, notificationData);
  }

  // Send booking reminder notification
  async sendBookingReminder(userId: string, bookingReference: string, parkingName: string, startTime: Date): Promise<void> {
    const notificationData: NotificationData = {
      title: 'Parking Reminder 🚗',
      body: `Your parking at ${parkingName} starts in 30 minutes. Don't forget to check in!`,
      type: 'booking',
      data: {
        bookingReference,
        parkingName,
        startTime: startTime.toISOString(),
        action: 'booking_reminder'
      }
    };

    await this.sendNotification(userId, notificationData);
  }

  // Send payment success notification
  async sendPaymentSuccess(userId: string, amount: number, currency: string, bookingReference: string): Promise<void> {
    const notificationData: NotificationData = {
      title: 'Payment Successful ✅',
      body: `Your payment of ${currency} ${amount} for booking ${bookingReference} was successful`,
      type: 'payment',
      data: {
        amount: amount.toString(),
        currency,
        bookingReference,
        action: 'payment_success'
      }
    };

    await this.sendNotification(userId, notificationData);
  }

  // Send payment failed notification
  async sendPaymentFailed(userId: string, amount: number, currency: string, bookingReference: string): Promise<void> {
    const notificationData: NotificationData = {
      title: 'Payment Failed ❌',
      body: `Your payment of ${currency} ${amount} for booking ${bookingReference} failed. Please try again.`,
      type: 'payment',
      data: {
        amount: amount.toString(),
        currency,
        bookingReference,
        action: 'payment_failed'
      }
    };

    await this.sendNotification(userId, notificationData);
  }

  // Send waitlist notification
  async sendWaitlistAvailable(userId: string, parkingName: string, availableUntil: Date): Promise<void> {
    const notificationData: NotificationData = {
      title: 'Parking Available! 🎯',
      body: `A spot at ${parkingName} is now available! Reserve it before ${availableUntil.toLocaleTimeString()}`,
      type: 'waitlist',
      data: {
        parkingName,
        availableUntil: availableUntil.toISOString(),
        action: 'waitlist_available'
      }
    };

    await this.sendNotification(userId, notificationData);
  }

  // Send waitlist position update
  async sendWaitlistPositionUpdate(userId: string, parkingName: string, position: number): Promise<void> {
    const notificationData: NotificationData = {
      title: 'Waitlist Update 📍',
      body: `You're now #${position} in line for ${parkingName}`,
      type: 'waitlist',
      data: {
        parkingName,
        position: position.toString(),
        action: 'waitlist_position_update'
      }
    };

    await this.sendNotification(userId, notificationData);
  }

  // Send booking cancellation notification
  async sendBookingCancellation(userId: string, bookingReference: string, refundAmount: number, currency: string): Promise<void> {
    const notificationData: NotificationData = {
      title: 'Booking Cancelled',
      body: refundAmount > 0 
        ? `Your booking ${bookingReference} has been cancelled. Refund of ${currency} ${refundAmount} will be processed.`
        : `Your booking ${bookingReference} has been cancelled.`,
      type: 'booking',
      data: {
        bookingReference,
        refundAmount: refundAmount.toString(),
        currency,
        action: 'booking_cancelled'
      }
    };

    await this.sendNotification(userId, notificationData);
  }

  // Send bulk notifications
  async sendBulkNotifications(userIds: string[], notificationData: NotificationData): Promise<void> {
    const promises = userIds.map(userId => this.sendNotification(userId, notificationData));
    await Promise.all(promises);
  }

  // Update user FCM token
  async updateUserFCMToken(userId: string, fcmToken: string): Promise<void> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      await userRepository.update(userId, { fcmToken });
      console.log(`FCM token updated for user ${userId}`);
    } catch (error) {
      console.error('Error updating FCM token:', error);
    }
  }

  // Helper methods
  private convertDataToStrings(data: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return result;
  }

  private mapNotificationType(type: string): 'info' | 'success' | 'warning' | 'error' {
    switch (type) {
      case 'payment':
        return 'info';
      case 'booking':
        return 'success';
      case 'waitlist':
        return 'warning';
      default:
        return 'info';
    }
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default NotificationService;