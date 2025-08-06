import AWS from 'aws-sdk';
import { logger } from '../utils/logger';
import type { Booking, BookingNotificationData } from '../types/Booking';

// Initialize AWS services
const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-east-1' });
const sns = new AWS.SNS({ region: process.env.AWS_REGION || 'us-east-1' });

export interface NotificationOptions {
  type: 'booking_confirmed' | 'booking_cancelled' | 'booking_reminder' | 'booking_updated';
  recipient: 'consumer' | 'business' | 'both';
  channels: ('email' | 'push' | 'sms')[];
  template: string;
  data: BookingNotificationData;
}

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface PushNotificationData {
  title: string;
  body: string;
  data?: { [key: string]: string };
}

class NotificationService {
  private readonly FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@buylocals.app';
  private readonly PUSH_TOPIC_ARN = process.env.SNS_PUSH_TOPIC_ARN;

  async send(options: NotificationOptions): Promise<void> {
    const { type, recipient, channels, template, data } = options;

    try {
      logger.info('Sending notification', {
        type,
        recipient,
        channels,
        template,
        bookingId: data.booking.id
      });

      const deliveryPromises = [];

      for (const channel of channels) {
        switch (channel) {
          case 'email':
            deliveryPromises.push(this.sendEmail(options));
            break;
          case 'push':
            deliveryPromises.push(this.sendPushNotification(options));
            break;
          case 'sms':
            deliveryPromises.push(this.sendSMS(options));
            break;
        }
      }

      // Send all notifications concurrently
      await Promise.allSettled(deliveryPromises);

      logger.info('Notification sent successfully', {
        type,
        recipient,
        channels,
        bookingId: data.booking.id
      });
    } catch (error) {
      logger.error('Failed to send notification', {
        error,
        type,
        recipient,
        bookingId: data.booking.id
      });
      throw error;
    }
  }

  async sendBookingConfirmation(data: BookingNotificationData): Promise<void> {
    await this.send({
      type: 'booking_confirmed',
      recipient: 'both',
      channels: ['email', 'push'],
      template: 'booking-confirmation',
      data
    });
  }

  async sendBookingCancellation(data: BookingNotificationData): Promise<void> {
    await this.send({
      type: 'booking_cancelled',
      recipient: 'both',
      channels: ['email', 'push'],
      template: 'booking-cancellation',
      data
    });
  }

  async sendBookingReminder(booking: Booking): Promise<void> {
    await this.send({
      type: 'booking_reminder',
      recipient: 'consumer',
      channels: ['email', 'push'],
      template: 'booking-reminder',
      data: { booking }
    });
  }

  private async sendEmail(options: NotificationOptions): Promise<void> {
    const { data, template, recipient } = options;
    
    try {
      const emailTemplates = this.generateEmailTemplate(template, data);
      const recipients = this.getEmailRecipients(recipient, data);

      for (const recipientEmail of recipients) {
        const params: AWS.SES.SendEmailRequest = {
          Source: this.FROM_EMAIL,
          Destination: {
            ToAddresses: [recipientEmail],
          },
          Message: {
            Subject: {
              Data: emailTemplates.subject,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: emailTemplates.htmlBody,
                Charset: 'UTF-8',
              },
              Text: {
                Data: emailTemplates.textBody,
                Charset: 'UTF-8',
              },
            },
          },
        };

        await ses.sendEmail(params).promise();
        
        logger.info('Email sent successfully', {
          template,
          recipient: recipientEmail,
          bookingId: data.booking.id
        });
      }
    } catch (error) {
      logger.error('Email sending failed', { error, template, recipient });
      throw error;
    }
  }

  private async sendPushNotification(options: NotificationOptions): Promise<void> {
    const { data, template, recipient } = options;
    
    if (!this.PUSH_TOPIC_ARN) {
      logger.warn('Push notification topic not configured, skipping push notification');
      return;
    }

    try {
      const pushData = this.generatePushNotificationData(template, data);
      
      const message = {
        default: pushData.body,
        GCM: JSON.stringify({
          data: {
            title: pushData.title,
            body: pushData.body,
            bookingId: data.booking.id,
            ...pushData.data,
          }
        }),
        APNS: JSON.stringify({
          aps: {
            alert: {
              title: pushData.title,
              body: pushData.body,
            },
            badge: 1,
            sound: 'default',
          },
          bookingId: data.booking.id,
          ...pushData.data,
        }),
      };

      const params: AWS.SNS.PublishRequest = {
        TopicArn: this.PUSH_TOPIC_ARN,
        Message: JSON.stringify(message),
        MessageStructure: 'json',
        MessageAttributes: {
          recipient: {
            DataType: 'String',
            StringValue: recipient,
          },
          bookingId: {
            DataType: 'String',
            StringValue: data.booking.id,
          },
        },
      };

      await sns.publish(params).promise();
      
      logger.info('Push notification sent successfully', {
        template,
        recipient,
        bookingId: data.booking.id
      });
    } catch (error) {
      logger.error('Push notification sending failed', { error, template, recipient });
      throw error;
    }
  }

  private async sendSMS(options: NotificationOptions): Promise<void> {
    const { data, template } = options;
    
    try {
      const phoneNumbers = this.getSMSRecipients(options.recipient, data);
      const message = this.generateSMSMessage(template, data);

      for (const phoneNumber of phoneNumbers) {
        const params: AWS.SNS.PublishRequest = {
          PhoneNumber: phoneNumber,
          Message: message,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional'
            }
          }
        };

        await sns.publish(params).promise();
        
        logger.info('SMS sent successfully', {
          template,
          recipient: phoneNumber.replace(/\d(?=\d{4})/g, '*'), // Mask phone number for logging
          bookingId: data.booking.id
        });
      }
    } catch (error) {
      logger.error('SMS sending failed', { error, template });
      throw error;
    }
  }

  private generateEmailTemplate(template: string, data: BookingNotificationData): EmailTemplate {
    const { booking, businessName, consumerName, refundAmount, reason } = data;
    
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    const formatTime = (date: Date) => date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    switch (template) {
      case 'booking-confirmation':
        return {
          subject: `Booking Confirmed - ${businessName}`,
          htmlBody: `
            <h2>Booking Confirmation</h2>
            <p>Hello ${consumerName || booking.customerInfo.name},</p>
            <p>Your booking has been confirmed! Here are the details:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>${businessName}</h3>
              <p><strong>Date:</strong> ${formatDate(booking.scheduledAt)}</p>
              <p><strong>Time:</strong> ${formatTime(booking.scheduledAt)}</p>
              <p><strong>Duration:</strong> ${booking.duration} minutes</p>
              ${booking.totalAmount > 0 ? `<p><strong>Total:</strong> $${booking.totalAmount.toFixed(2)}</p>` : ''}
              ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
            </div>
            <p><strong>Confirmation Number:</strong> ${booking.id.substring(0, 8).toUpperCase()}</p>
            <p>Thank you for choosing ${businessName}!</p>
          `,
          textBody: `
Booking Confirmation

Hello ${consumerName || booking.customerInfo.name},

Your booking has been confirmed! Here are the details:

${businessName}
Date: ${formatDate(booking.scheduledAt)}
Time: ${formatTime(booking.scheduledAt)}
Duration: ${booking.duration} minutes
${booking.totalAmount > 0 ? `Total: $${booking.totalAmount.toFixed(2)}` : ''}
${booking.notes ? `Notes: ${booking.notes}` : ''}

Confirmation Number: ${booking.id.substring(0, 8).toUpperCase()}

Thank you for choosing ${businessName}!
          `
        };

      case 'booking-cancellation':
        return {
          subject: `Booking Cancelled - ${businessName}`,
          htmlBody: `
            <h2>Booking Cancellation</h2>
            <p>Hello ${consumerName || booking.customerInfo.name},</p>
            <p>Your booking has been cancelled. Here are the details:</p>
            <div style="background-color: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>${businessName}</h3>
              <p><strong>Date:</strong> ${formatDate(booking.scheduledAt)}</p>
              <p><strong>Time:</strong> ${formatTime(booking.scheduledAt)}</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              ${refundAmount && refundAmount > 0 ? `<p><strong>Refund Amount:</strong> $${refundAmount.toFixed(2)}</p>` : ''}
            </div>
            <p><strong>Confirmation Number:</strong> ${booking.id.substring(0, 8).toUpperCase()}</p>
            ${refundAmount && refundAmount > 0 ? '<p>Your refund will be processed within 3-5 business days.</p>' : ''}
            <p>We hope to see you again soon!</p>
          `,
          textBody: `
Booking Cancellation

Hello ${consumerName || booking.customerInfo.name},

Your booking has been cancelled. Here are the details:

${businessName}
Date: ${formatDate(booking.scheduledAt)}
Time: ${formatTime(booking.scheduledAt)}
${reason ? `Reason: ${reason}` : ''}
${refundAmount && refundAmount > 0 ? `Refund Amount: $${refundAmount.toFixed(2)}` : ''}

Confirmation Number: ${booking.id.substring(0, 8).toUpperCase()}

${refundAmount && refundAmount > 0 ? 'Your refund will be processed within 3-5 business days.' : ''}

We hope to see you again soon!
          `
        };

      case 'booking-reminder':
        return {
          subject: `Appointment Reminder - ${businessName}`,
          htmlBody: `
            <h2>Appointment Reminder</h2>
            <p>Hello ${booking.customerInfo.name},</p>
            <p>This is a reminder about your upcoming appointment:</p>
            <div style="background-color: #e6f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>${businessName}</h3>
              <p><strong>Date:</strong> ${formatDate(booking.scheduledAt)}</p>
              <p><strong>Time:</strong> ${formatTime(booking.scheduledAt)}</p>
              <p><strong>Duration:</strong> ${booking.duration} minutes</p>
            </div>
            <p>We look forward to seeing you!</p>
          `,
          textBody: `
Appointment Reminder

Hello ${booking.customerInfo.name},

This is a reminder about your upcoming appointment:

${businessName}
Date: ${formatDate(booking.scheduledAt)}
Time: ${formatTime(booking.scheduledAt)}
Duration: ${booking.duration} minutes

We look forward to seeing you!
          `
        };

      default:
        return {
          subject: 'Booking Update',
          htmlBody: '<p>Your booking has been updated.</p>',
          textBody: 'Your booking has been updated.'
        };
    }
  }

  private generatePushNotificationData(template: string, data: BookingNotificationData): PushNotificationData {
    const { booking, businessName } = data;
    
    const formatTime = (date: Date) => date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    switch (template) {
      case 'booking-confirmation':
        return {
          title: 'Booking Confirmed!',
          body: `Your appointment at ${businessName} is confirmed for ${formatTime(booking.scheduledAt)}`,
          data: {
            type: 'booking_confirmed',
            bookingId: booking.id,
          }
        };

      case 'booking-cancellation':
        return {
          title: 'Booking Cancelled',
          body: `Your appointment at ${businessName} has been cancelled`,
          data: {
            type: 'booking_cancelled',
            bookingId: booking.id,
          }
        };

      case 'booking-reminder':
        return {
          title: 'Appointment Reminder',
          body: `Your appointment at ${businessName} is coming up at ${formatTime(booking.scheduledAt)}`,
          data: {
            type: 'booking_reminder',
            bookingId: booking.id,
          }
        };

      default:
        return {
          title: 'Booking Update',
          body: 'Your booking has been updated',
          data: {
            type: 'booking_update',
            bookingId: booking.id,
          }
        };
    }
  }

  private generateSMSMessage(template: string, data: BookingNotificationData): string {
    const { booking, businessName } = data;
    
    const formatDateTime = (date: Date) => date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    switch (template) {
      case 'booking-confirmation':
        return `Booking confirmed! ${businessName} on ${formatDateTime(booking.scheduledAt)}. Confirmation: ${booking.id.substring(0, 8).toUpperCase()}`;

      case 'booking-cancellation':
        return `Booking cancelled: ${businessName} on ${formatDateTime(booking.scheduledAt)}. Ref: ${booking.id.substring(0, 8).toUpperCase()}`;

      case 'booking-reminder':
        return `Reminder: Your appointment at ${businessName} is at ${formatDateTime(booking.scheduledAt)}. See you soon!`;

      default:
        return `Your booking with ${businessName} has been updated.`;
    }
  }

  private getEmailRecipients(recipient: string, data: BookingNotificationData): string[] {
    const emails: string[] = [];
    
    if (recipient === 'consumer' || recipient === 'both') {
      emails.push(data.booking.customerInfo.email);
    }
    
    if (recipient === 'business' || recipient === 'both') {
      // This would typically come from business info
      // For now, using a placeholder or environment variable
      const businessEmail = process.env.BUSINESS_EMAIL || 'business@example.com';
      emails.push(businessEmail);
    }
    
    return emails;
  }

  private getSMSRecipients(recipient: string, data: BookingNotificationData): string[] {
    const phoneNumbers: string[] = [];
    
    if (recipient === 'consumer' || recipient === 'both') {
      phoneNumbers.push(data.booking.customerInfo.phone);
    }
    
    if (recipient === 'business' || recipient === 'both') {
      // This would typically come from business info
      const businessPhone = process.env.BUSINESS_PHONE;
      if (businessPhone) {
        phoneNumbers.push(businessPhone);
      }
    }
    
    return phoneNumbers;
  }
}

export const notificationService = new NotificationService();