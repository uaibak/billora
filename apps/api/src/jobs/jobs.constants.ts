export const QUEUE_NAMES = {
  email: 'billora-email',
  pdf: 'billora-pdf',
  payments: 'billora-payments',
  webhooks: 'billora-webhooks',
} as const;

export type QueueKey = keyof typeof QUEUE_NAMES;

export const JOB_NAMES = {
  sendInvoiceEmail: 'invoice.email.send',
  generateInvoicePdf: 'invoice.pdf.generate',
  paymentWebhook: 'payment.webhook.process',
  dispatchWebhook: 'webhook.dispatch',
} as const;
