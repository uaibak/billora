export type UserRole = 'USER' | 'ADMIN';
export type OrganizationMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type OrganizationInviteStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type PaymentProvider = 'MANUAL' | 'STRIPE' | 'PAYPAL' | 'LOCAL_BANK' | 'JAZZCASH' | 'EASYPAYSA';
export type InvoiceDeliveryStatus = 'NOT_SENT' | 'QUEUED' | 'SENT' | 'FAILED';
export type InvoicePdfStatus = 'NOT_GENERATED' | 'QUEUED' | 'GENERATED' | 'FAILED';
export type AuditAction =
  | 'ORGANIZATION_CREATED'
  | 'ORGANIZATION_UPDATED'
  | 'BUSINESS_CREATED'
  | 'BUSINESS_UPDATED'
  | 'BUSINESS_DELETED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_DELETED'
  | 'INVOICE_SENT'
  | 'INVOICE_MARKED_PAID'
  | 'PAYMENT_RECORDED'
  | 'INVOICE_PDF_QUEUED'
  | 'INVOICE_EMAIL_QUEUED'
  | 'INVOICE_EMAIL_SENT'
  | 'INVOICE_EMAIL_FAILED'
  | 'ORGANIZATION_INVITE_CREATED'
  | 'ORGANIZATION_INVITE_RESENT'
  | 'ORGANIZATION_INVITE_ACCEPTED'
  | 'ORGANIZATION_INVITE_CANCELLED';
export type AuditEntityType = 'ORGANIZATION' | 'BUSINESS' | 'CUSTOMER' | 'INVOICE' | 'PAYMENT' | 'USER';
export interface User { id: string; email: string; fullName: string; phone?: string; role: UserRole; createdAt: string; updatedAt: string; }
export interface Organization { id: string; ownerId: string; name: string; slug: string; createdAt?: string; updatedAt?: string; }
export interface OrganizationMember { id: string; organizationId: string; userId: string; role: OrganizationMemberRole; user?: User; organization?: Organization; createdAt?: string; updatedAt?: string; }
export interface OrganizationInvite { id: string; organizationId: string; email: string; role: OrganizationMemberRole; token: string; status: OrganizationInviteStatus; invitedById: string; acceptedById?: string; expiresAt: string; acceptedAt?: string; cancelledAt?: string; invitedBy?: Pick<User, 'id' | 'email' | 'fullName'>; acceptedBy?: Pick<User, 'id' | 'email' | 'fullName'>; createdAt: string; updatedAt: string; }
export interface Business { id: string; organizationId: string; organization?: Pick<Organization, 'id' | 'name' | 'slug'>; name: string; email?: string; phone?: string; address?: string; city?: string; country?: string; taxNumber?: string; logoUrl?: string; createdAt?: string; updatedAt?: string; }
export interface Customer { id: string; businessId: string; name: string; email?: string; phone?: string; address?: string; city?: string; country?: string; business?: Pick<Business, 'id' | 'name'>; createdAt?: string; updatedAt?: string; }
export interface InvoiceItem { id: string; invoiceId: string; description: string; quantity: number; unitPrice: number; taxRate: number; lineTotal: number; }
export interface Payment { id: string; invoiceId: string; amount: number; provider: PaymentProvider; providerReference?: string; status: PaymentStatus; paidAt?: string; createdAt?: string; updatedAt?: string; }
export interface Invoice { id: string; businessId: string; customerId: string; invoiceNumber: string; issueDate: string; dueDate: string; status: InvoiceStatus; subtotal: number; taxAmount: number; discountAmount: number; totalAmount: number; notes?: string; publicToken?: string; pdfStatus?: InvoicePdfStatus; pdfPath?: string; pdfGeneratedAt?: string; emailStatus?: InvoiceDeliveryStatus; emailedAt?: string; lastEmailError?: string; items?: InvoiceItem[]; payments?: Payment[]; customer?: Customer; business?: Business; createdAt?: string; updatedAt?: string; }
export interface AuditLog { id: string; organizationId: string; userId: string; action: AuditAction; entityType: AuditEntityType; entityId: string; metadata?: unknown; user?: Pick<User, 'id' | 'email' | 'fullName'>; createdAt: string; }
export interface DashboardSummary { organizationId: string; businesses: number; customers: number; invoices: number; total: number; collected: number; sent: number; outstanding: number; overdue: number; byStatus: Record<string, number>; recentInvoices: Array<Pick<Invoice, 'id' | 'invoiceNumber' | 'status' | 'totalAmount' | 'dueDate' | 'createdAt'> & { customer?: Pick<Customer, 'name'>; business?: Pick<Business, 'name'> }>; }
