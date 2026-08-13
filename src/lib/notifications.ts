import { NotificationChannel, NotificationType, NotificationLog } from '../types';
import { getStorageData, saveStorageData } from './storage';

export const AEC_ADMIN_EMAIL = 'info@ansumana.com';
export const AEC_ADMIN_PHONE = '+231 088 125 2254';
export const AEC_ADMIN_WHATSAPP = '+231 077 530 1445';
export const AEC_PHONE_MAIN = AEC_ADMIN_PHONE;
export const AEC_WHATSAPP_MAIN = AEC_ADMIN_WHATSAPP;

export const CONTACT_INFO = {
  address: '72nd SKD Boulevard, Paynesville City, Montserrado County, Republic of Liberia',
  phone: AEC_ADMIN_PHONE,
  whatsapp: AEC_ADMIN_WHATSAPP,
  email: AEC_ADMIN_EMAIL,
};

export interface SendNotificationParams {
  to: string;
  subject: string;
  body: string;
  notificationType: NotificationType;
  channel?: NotificationChannel;
  proponentId?: string;
  reportScheduleId?: string;
  findingId?: string;
}

export function sendNotification(params: SendNotificationParams): NotificationLog {
  const data = getStorageData();
  const channel = params.channel || 'Email';

  const newLog: NotificationLog = {
    id: 'log-' + Math.random().toString(36).substring(2, 9),
    proponent_id: params.proponentId,
    report_schedule_id: params.reportScheduleId,
    finding_id: params.findingId,
    channel,
    notification_type: params.notificationType,
    recipient: params.to,
    subject: params.subject,
    message_body: params.body,
    status: 'Sent',
    created_date: new Date().toISOString(),
  };

  data.logs.unshift(newLog);
  saveStorageData(data);

  if (data.companySettings?.enable_whatsapp_notifications) {
    const waLog: NotificationLog = {
      ...newLog,
      id: 'log-wa-' + Math.random().toString(36).substring(2, 9),
      channel: 'WhatsApp',
      recipient: params.to,
    };
    data.logs.unshift(waLog);
    saveStorageData(data);
  }

  return newLog;
}

export function sendEmailNotification(params: SendNotificationParams): NotificationLog {
  return sendNotification({ ...params, channel: 'Email' });
}

export function sendWhatsAppNotification(params: SendNotificationParams): NotificationLog {
  return sendNotification({ ...params, channel: 'WhatsApp' });
}
