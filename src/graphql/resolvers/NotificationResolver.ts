import { Resolver, Mutation, Query, Arg, Ctx, UseMiddleware, ID } from 'type-graphql';
import { AppDataSource } from '../../database/connection';
import { Notification, NotificationStatus, NotificationType as NotificationTypeEnum, NotificationChannel } from '../../entities/Notification';
import { User } from '../../entities/User';
import { Context } from '@/type';
import NotificationService from '../../services/notification';
import { In, MoreThan } from 'typeorm';
import { AuthMiddleware } from '@/middleware/graphqlAuth';
import { NotificationType, NotificationPreferencesType, NotificationStatsType } from '../types/shared';

@Resolver()
export class NotificationResolver {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async updateFCMToken(
    @Arg('fcmToken') fcmToken: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const userRepository = AppDataSource.getRepository(User);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const user = await userRepository.findOne({ where: { id: context.user.id } });
    if (!user) {
      throw new Error('User not found');
    }

    user.fcmToken = fcmToken;
    await userRepository.save(user);

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async markNotificationAsRead(
    @Arg('notificationId', () => ID) notificationId: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    const notificationRepository = AppDataSource.getRepository(Notification);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const notification = await notificationRepository.findOne({
      where: {
        id: notificationId,
        userId: context.user.id
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.markAsRead();
    await notificationRepository.save(notification);

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async markAllNotificationsAsRead(
    @Ctx() context: Context
  ): Promise<boolean> {
    const notificationRepository = AppDataSource.getRepository(Notification);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    await notificationRepository.update(
      {
        userId: context.user.id,
        status: In([NotificationStatus.PENDING, NotificationStatus.SENT, NotificationStatus.DELIVERED])
      },
      {
        status: NotificationStatus.READ,
        readAt: new Date()
      }
    );

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async deleteNotification(
    @Arg('notificationId', () => ID) notificationId: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    const notificationRepository = AppDataSource.getRepository(Notification);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const result = await notificationRepository.delete({
      id: notificationId,
      userId: context.user.id
    });

    if (result.affected === 0) {
      throw new Error('Notification not found');
    }

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async clearAllNotifications(
    @Ctx() context: Context
  ): Promise<boolean> {
    const notificationRepository = AppDataSource.getRepository(Notification);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    await notificationRepository.delete({
      userId: context.user.id
    });

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async updateNotificationPreferences(
    @Ctx() context: Context,
    @Arg('pushNotifications', { nullable: true }) pushNotifications?: boolean,
    @Arg('emailNotifications', { nullable: true }) emailNotifications?: boolean,
    @Arg('smsNotifications', { nullable: true }) smsNotifications?: boolean,
    @Arg('bookingReminders', { nullable: true }) bookingReminders?: boolean,
    @Arg('paymentNotifications', { nullable: true }) paymentNotifications?: boolean,
    @Arg('waitlistNotifications', { nullable: true }) waitlistNotifications?: boolean,
    @Arg('marketingNotifications', { nullable: true }) marketingNotifications?: boolean
  ): Promise<boolean> {
    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({ where: { id: context.user.id } });
    if (!user) {
      throw new Error('User not found');
    }

    // Update user preferences (assuming preferences is a JSON field)
    const currentPreferences = user.preferences || {
      notifications: true,
      emailNotifications: true,
      smsNotifications: false
    };
    const notificationPreferences = {
      notifications: currentPreferences.notifications ?? true,
      emailNotifications: currentPreferences.emailNotifications ?? true,
      smsNotifications: currentPreferences.smsNotifications ?? false,
      push: true,
      email: true,
      sms: false,
      bookingReminders: true,
      payment: true,
      waitlist: true,
      marketing: false
    };

    if (pushNotifications !== undefined) notificationPreferences.push = pushNotifications;
    if (emailNotifications !== undefined) {
      notificationPreferences.email = emailNotifications;
      notificationPreferences.emailNotifications = emailNotifications;
    }
    if (smsNotifications !== undefined) {
      notificationPreferences.sms = smsNotifications;
      notificationPreferences.smsNotifications = smsNotifications;
    }
    if (bookingReminders !== undefined) notificationPreferences.bookingReminders = bookingReminders;
    if (paymentNotifications !== undefined) notificationPreferences.payment = paymentNotifications;
    if (waitlistNotifications !== undefined) notificationPreferences.waitlist = waitlistNotifications;
    if (marketingNotifications !== undefined) notificationPreferences.marketing = marketingNotifications;

    user.preferences = {
      notifications: notificationPreferences.notifications,
      emailNotifications: notificationPreferences.emailNotifications,
      smsNotifications: notificationPreferences.smsNotifications
    };

    await userRepository.save(user);

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async testNotification(
    @Arg('title') title: string,
    @Arg('message') message: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    if (!context.user) {
      throw new Error('User not authenticated');
    }

    await this.notificationService.sendNotification(context.user.id, {
      title,
      body: message,
      type: 'general',
      data: {
        test: true
      }
    });

    return true;
  }

  @Query(() => [NotificationType])
  @UseMiddleware(AuthMiddleware)
  async getNotifications(
    @Arg('limit', { defaultValue: 20 }) limit: number,
    @Arg('offset', { defaultValue: 0 }) offset: number,
    @Arg('unreadOnly', { defaultValue: false }) unreadOnly: boolean,
    @Ctx() context: Context
  ): Promise<NotificationType[]> {
    const notificationRepository = AppDataSource.getRepository(Notification);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const whereCondition: any = {
      userId: context.user.id
    };

    if (unreadOnly) {
      whereCondition.status = In([NotificationStatus.PENDING, NotificationStatus.SENT, NotificationStatus.DELIVERED]);
    }

    const notifications = await notificationRepository.find({
      where: whereCondition,
      order: {
        createdAt: 'DESC'
      },
      take: Math.min(limit, 100), // Max 100 notifications per request
      skip: offset
    });

    return notifications.map(notification => ({
      ...notification,
      data: notification.data ? JSON.stringify(notification.data) : undefined
    }));
  }

  @Query(() => Number)
  @UseMiddleware(AuthMiddleware)
  async getUnreadNotificationCount(
    @Ctx() context: Context
  ): Promise<number> {
    const notificationRepository = AppDataSource.getRepository(Notification);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    return await notificationRepository.count({
      where: {
        userId: context.user.id,
        status: In([NotificationStatus.PENDING, NotificationStatus.SENT, NotificationStatus.DELIVERED])
      }
    });
  }

  @Query(() => [NotificationType])
  @UseMiddleware(AuthMiddleware)
  async getNotificationsByType(
    @Arg('type') type: NotificationTypeEnum,
    @Arg('limit', { defaultValue: 20 }) limit: number,
    @Arg('offset', { defaultValue: 0 }) offset: number,
    @Ctx() context: Context
  ): Promise<NotificationType[]> {
    const notificationRepository = AppDataSource.getRepository(Notification);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const notifications = await notificationRepository.find({
      where: {
        userId: context.user.id,
        type
      },
      order: {
        createdAt: 'DESC'
      },
      take: Math.min(limit, 100),
      skip: offset
    });

    return notifications.map(notification => ({
      ...notification,
      data: notification.data ? JSON.stringify(notification.data) : undefined
    }));
  }

  @Query(() => NotificationType)
  @UseMiddleware(AuthMiddleware)
  async getNotification(
    @Arg('notificationId', () => ID) notificationId: string,
    @Ctx() context: Context
  ): Promise<NotificationType> {
    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const notificationRepository = AppDataSource.getRepository(Notification);

    const notification = await notificationRepository.findOne({
      where: {
        id: notificationId,
        userId: context.user.id
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    // Mark as read if it wasn't already
    if (notification.status !== NotificationStatus.READ) {
      notification.markAsRead();
      await notificationRepository.save(notification);
    }

    return {
      ...notification,
      data: notification.data ? JSON.stringify(notification.data) : undefined
    };
  }

  @Query(() => NotificationPreferencesType)
  @UseMiddleware(AuthMiddleware)
  async getNotificationPreferences(
    @Ctx() context: Context
  ): Promise<NotificationPreferencesType> {
    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({ where: { id: context.user.id } });
    if (!user) {
      throw new Error('User not found');
    }

    const preferences = user.preferences || {
      notifications: true,
      emailNotifications: true,
      smsNotifications: false
    };
    const notificationPreferences = {
      notifications: preferences.notifications ?? true,
      emailNotifications: preferences.emailNotifications ?? true,
      smsNotifications: preferences.smsNotifications ?? false,
      push: true,
      email: true,
      sms: false,
      bookingReminders: true,
      payment: true,
      waitlist: true,
      marketing: false
    };

    return notificationPreferences;
  }

  @Query(() => [NotificationStatsType])
  @UseMiddleware(AuthMiddleware)
  async getNotificationStats(
    @Arg('days', { defaultValue: 30 }) days: number,
    @Ctx() context: Context
  ): Promise<NotificationStatsType[]> {
    const notificationRepository = AppDataSource.getRepository(Notification);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const notifications = await notificationRepository.find({
      where: {
        userId: context.user.id,
        createdAt: MoreThan(startDate)
      },
      select: ['type', 'status', 'createdAt']
    });

    // Group by type and status
    const stats = notifications.reduce((acc, notification) => {
      const key = `${notification.type}_${notification.status}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array format
    return Object.entries(stats).map(([key, count]) => {
      const parts = key.split('_');
      const type = parts[0] || 'unknown';
      const status = parts[1] || 'unknown';
      return { type, status, count };
    });
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async scheduleNotification(
    @Ctx() context: Context,
    @Arg('title') title: string,
    @Arg('message') message: string,
    @Arg('scheduledFor') scheduledFor: Date,
    @Arg('type', { defaultValue: NotificationTypeEnum.GENERAL }) type: NotificationTypeEnum = NotificationTypeEnum.GENERAL,
    @Arg('data', { nullable: true }) data?: string
  ): Promise<boolean> {
    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const notificationRepository = AppDataSource.getRepository(Notification);

    if (scheduledFor <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    const notification = notificationRepository.create({
      userId: context.user.id,
      type,
      title,
      message,
      scheduledFor,
      channel: NotificationChannel.PUSH,
      status: NotificationStatus.PENDING,
      data: data ? JSON.parse(data) : undefined
    });

    await notificationRepository.save(notification);

    return true;
  }

  @Query(() => [NotificationType])
  @UseMiddleware(AuthMiddleware)
  async getScheduledNotifications(
    @Ctx() context: Context
  ): Promise<NotificationType[]> {
    const notificationRepository = AppDataSource.getRepository(Notification);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const notifications = await notificationRepository.find({
      where: {
        userId: context.user.id,
        status: NotificationStatus.PENDING,
        scheduledFor: MoreThan(new Date())
      },
      order: {
        scheduledFor: 'ASC'
      }
    });

    return notifications.map(notification => ({
      ...notification,
      data: notification.data ? JSON.stringify(notification.data) : undefined
    }));
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async cancelScheduledNotification(
    @Arg('notificationId', () => ID) notificationId: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    const notificationRepository = AppDataSource.getRepository(Notification);

    if (!context.user) {
      throw new Error('User not authenticated');
    }

    const notification = await notificationRepository.findOne({
      where: {
        id: notificationId,
        userId: context.user.id,
        status: NotificationStatus.PENDING
      }
    });

    if (!notification) {
      throw new Error('Scheduled notification not found');
    }

    await notificationRepository.delete({ id: notificationId });

    return true;
  }
}