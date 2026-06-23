export type UserRole = 'USER' | 'ADMIN';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type PaymentProvider = 'MANUAL' | 'STRIPE' | 'PAYPAL' | 'LOCAL_BANK' | 'JAZZCASH' | 'EASYPAYSA';
export interface User { id: string; email: string; fullName: string; phone?: string; role: UserRole; createdAt: string; updatedAt: string; }
export interface Business { id: string; userId: string; name: string; email?: string; phone?: string; address?: string; city?: string; country?: string; taxNumber?: string; logoUrl?: string; createdAt?: string; updatedAt?: string; }
export interface Customer { id: string; businessId: string; name: string; email?: string; phone?: string; address?: string; city?: string; country?: string; business?: Pick<Business, 'id' | 'name'>; createdAt?: string; updatedAt?: string; }
export interface InvoiceItem { id: string; invoiceId: string; description: string; quantity: number; unitPrice: number; taxRate: number; lineTotal: number; }
export interface Payment { id: string; invoiceId: string; amount: number; provider: PaymentProvider; providerReference?: string; status: PaymentStatus; paidAt?: string; createdAt?: string; updatedAt?: string; }
export interface Invoice { id: string; businessId: string; customerId: string; invoiceNumber: string; issueDate: string; dueDate: string; status: InvoiceStatus; subtotal: number; taxAmount: number; discountAmount: number; totalAmount: number; notes?: string; items?: InvoiceItem[]; payments?: Payment[]; customer?: Customer; business?: Business; createdAt?: string; updatedAt?: string; }
