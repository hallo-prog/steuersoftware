import { ExtractedDeadline, Task, Deadline, Document } from '../types';
import { auditService } from './auditService';

// Notification service for deadline reminders (FR-08)
export interface NotificationPreferences {
  email?: string;
  enableEmailNotifications: boolean;
  enablePushNotifications: boolean;
  enableInAppNotifications: boolean;
  reminderDays: number[]; // Days before deadline to send reminders
}

export interface PendingNotification {
  id: string;
  type: 'deadline' | 'task' | 'system';
  title: string;
  message: string;
  scheduledFor: Date;
  entityId: string;
  entityType: 'document' | 'task' | 'deadline';
  sent: boolean;
  sentAt?: Date;
  retryCount: number;
  maxRetries: number;
}

export class NotificationService {
  private preferences: NotificationPreferences = {
    enableEmailNotifications: true,
    enablePushNotifications: true,
    enableInAppNotifications: true,
    reminderDays: [14, 7, 2, 1] // Default: remind 14, 7, 2, and 1 days before
  };

  private pendingNotifications: PendingNotification[] = [];
  private inAppNotifications: PendingNotification[] = [];
  private listeners: ((notifications: PendingNotification[]) => void)[] = [];

  // Update notification preferences
  updatePreferences(newPreferences: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...newPreferences };
  }

  // Get current preferences
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  // Schedule notifications for document deadlines (FR-08)
  scheduleDeadlineNotifications(document: Document): PendingNotification[] {
    const notifications: PendingNotification[] = [];

    if (!document.extractedDeadlines || document.extractedDeadlines.length === 0) {
      return notifications;
    }

    document.extractedDeadlines.forEach(deadline => {
      this.preferences.reminderDays.forEach(daysBefore => {
        const notificationDate = new Date(deadline.dueDate);
        notificationDate.setDate(notificationDate.getDate() - daysBefore);

        // Only schedule future notifications
        if (notificationDate > new Date()) {
          const notification: PendingNotification = {
            id: `deadline-${deadline.id}-${daysBefore}d`,
            type: 'deadline',
            title: `Frist-Erinnerung: ${deadline.type}`,
            message: `${deadline.description} - Frist läuft ${daysBefore === 1 ? 'morgen' : `in ${daysBefore} Tagen`} ab (${deadline.dueDate.toLocaleDateString('de-DE')})`,
            scheduledFor: notificationDate,
            entityId: document.id,
            entityType: 'document',
            sent: false,
            retryCount: 0,
            maxRetries: 3
          };

          notifications.push(notification);
          this.pendingNotifications.push(notification);
        }
      });
    });

    // Sort by scheduled date
    this.pendingNotifications.sort((a, b) => 
      a.scheduledFor.getTime() - b.scheduledFor.getTime()
    );

    auditService.logAction(
      'deadline_notifications_scheduled',
      'document',
      document.id,
      { 
        deadlineCount: document.extractedDeadlines.length,
        notificationCount: notifications.length 
      },
      true
    );

    return notifications;
  }

  // Schedule notifications for tasks
  scheduleTaskNotifications(task: Task): PendingNotification[] {
    const notifications: PendingNotification[] = [];

    if (!task.dueDate) return notifications;

    this.preferences.reminderDays.forEach(daysBefore => {
      const notificationDate = new Date(task.dueDate!);
      notificationDate.setDate(notificationDate.getDate() - daysBefore);

      // Only schedule future notifications
      if (notificationDate > new Date()) {
        const notification: PendingNotification = {
          id: `task-${task.id}-${daysBefore}d`,
          type: 'task',
          title: `Aufgaben-Erinnerung: ${task.title}`,
          message: `Aufgabe "${task.title}" ist ${daysBefore === 1 ? 'morgen' : `in ${daysBefore} Tagen`} fällig (${task.dueDate.toLocaleDateString('de-DE')})`,
          scheduledFor: notificationDate,
          entityId: task.id,
          entityType: 'task',
          sent: false,
          retryCount: 0,
          maxRetries: 3
        };

        notifications.push(notification);
        this.pendingNotifications.push(notification);
      }
    });

    return notifications;
  }

  // Check and send due notifications
  async processPendingNotifications(): Promise<number> {
    const now = new Date();
    let sentCount = 0;

    const dueNotifications = this.pendingNotifications.filter(
      notification => !notification.sent && notification.scheduledFor <= now
    );

    for (const notification of dueNotifications) {
      try {
        await this.sendNotification(notification);
        notification.sent = true;
        notification.sentAt = new Date();
        sentCount++;

        auditService.logNotificationSent(
          notification.type,
          notification.entityId,
          {
            title: notification.title,
            scheduledFor: notification.scheduledFor,
            sentAt: notification.sentAt
          },
          true
        );
      } catch (error) {
        notification.retryCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        auditService.logNotificationSent(
          notification.type,
          notification.entityId,
          {
            title: notification.title,
            retryCount: notification.retryCount,
            error: errorMessage
          },
          false,
          errorMessage
        );

        // Remove notification if max retries exceeded
        if (notification.retryCount >= notification.maxRetries) {
          const index = this.pendingNotifications.indexOf(notification);
          if (index > -1) {
            this.pendingNotifications.splice(index, 1);
          }
        }
      }
    }

    // Clean up sent notifications older than 30 days
    this.cleanupOldNotifications();

    return sentCount;
  }

  // Send individual notification
  private async sendNotification(notification: PendingNotification): Promise<void> {
    // In-app notification (always enabled)
    this.addInAppNotification(notification);

    // Email notification
    if (this.preferences.enableEmailNotifications && this.preferences.email) {
      await this.sendEmailNotification(notification);
    }

    // Push notification
    if (this.preferences.enablePushNotifications) {
      await this.sendPushNotification(notification);
    }
  }

  // Add in-app notification
  private addInAppNotification(notification: PendingNotification) {
    this.inAppNotifications.unshift({ ...notification });
    
    // Keep only last 100 in-app notifications
    if (this.inAppNotifications.length > 100) {
      this.inAppNotifications = this.inAppNotifications.slice(0, 100);
    }

    this.notifyListeners();
  }

  // Send email notification (placeholder - would need backend implementation)
  private async sendEmailNotification(notification: PendingNotification): Promise<void> {
    // This would integrate with email service in a real implementation
    // For now, we'll simulate the call
    console.log(`Sending email notification: ${notification.title} to ${this.preferences.email}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Send push notification (placeholder - would need service worker)
  private async sendPushNotification(notification: PendingNotification): Promise<void> {
    // This would use the Push API in a real implementation
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.type === 'deadline'
      });
    }
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<boolean> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  // Get all pending notifications
  getPendingNotifications(): PendingNotification[] {
    return [...this.pendingNotifications];
  }

  // Get in-app notifications
  getInAppNotifications(): PendingNotification[] {
    return [...this.inAppNotifications];
  }

  // Mark in-app notification as read
  markNotificationAsRead(notificationId: string): boolean {
    const index = this.inAppNotifications.findIndex(n => n.id === notificationId);
    if (index > -1) {
      this.inAppNotifications.splice(index, 1);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Clear all in-app notifications
  clearAllInAppNotifications() {
    this.inAppNotifications = [];
    this.notifyListeners();
  }

  // Add listener for in-app notification updates
  addListener(listener: (notifications: PendingNotification[]) => void) {
    this.listeners.push(listener);
  }

  // Remove listener
  removeListener(listener: (notifications: PendingNotification[]) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Notify all listeners
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.inAppNotifications));
  }

  // Get upcoming notifications (next 7 days)
  getUpcomingNotifications(): PendingNotification[] {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return this.pendingNotifications
      .filter(n => !n.sent && n.scheduledFor <= sevenDaysFromNow)
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  }

  // Get overdue notifications
  getOverdueNotifications(): PendingNotification[] {
    const now = new Date();
    return this.pendingNotifications
      .filter(n => !n.sent && n.scheduledFor < now)
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  }

  // Clean up old notifications
  private cleanupOldNotifications() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.pendingNotifications = this.pendingNotifications.filter(
      notification => 
        !notification.sent || 
        (notification.sentAt && notification.sentAt > thirtyDaysAgo)
    );

    this.inAppNotifications = this.inAppNotifications.filter(
      notification => notification.scheduledFor > thirtyDaysAgo
    );
  }

  // Cancel notifications for a specific entity
  cancelNotifications(entityId: string, entityType: string): number {
    const initialCount = this.pendingNotifications.length;
    
    this.pendingNotifications = this.pendingNotifications.filter(
      notification => 
        !(notification.entityId === entityId && notification.entityType === entityType)
    );

    const canceledCount = initialCount - this.pendingNotifications.length;
    
    if (canceledCount > 0) {
      auditService.logAction(
        'notifications_canceled',
        entityType,
        entityId,
        { canceledCount },
        true
      );
    }

    return canceledCount;
  }

  // Start automatic notification processing (call this periodically)
  startNotificationProcessor(intervalMinutes: number = 5): void {
    setInterval(async () => {
      await this.processPendingNotifications();
    }, intervalMinutes * 60 * 1000);
  }

  // Get notification statistics
  getStatistics() {
    const total = this.pendingNotifications.length;
    const sent = this.pendingNotifications.filter(n => n.sent).length;
    const pending = total - sent;
    const overdue = this.getOverdueNotifications().length;

    return {
      total,
      sent,
      pending,
      overdue,
      inApp: this.inAppNotifications.length
    };
  }
}

// Singleton instance
export const notificationService = new NotificationService();