import type { Business, Customer, Invoice, Payment, User } from '@billora/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'billora_token';
export const AUTH_EXPIRED_EVENT = 'billora:auth-expired';

export type AuthResponse = { accessToken: string; user: User };
export type InvoiceInputItem = { description: string; quantity: number; unitPrice: number; taxRate: number };
export type CreateInvoiceInput = {
  businessId: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  discountAmount: number;
  notes?: string;
  items: InvoiceInputItem[];
};
export type UpdateInvoiceInput = Partial<Omit<CreateInvoiceInput, 'businessId'>> & { status?: string };

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(message || `Request failed with status ${response.status}`, response.status, data);
  }

  return data as T;
}

export const api = {
  login: (body: { email: string; password: string }) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body: { fullName: string; email: string; password: string }) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  me: () => apiRequest<User>('/auth/me'),
  businesses: () => apiRequest<Business[]>('/businesses'),
  createBusiness: (body: Partial<Business> & { name: string }) =>
    apiRequest<Business>('/businesses', { method: 'POST', body: JSON.stringify(body) }),
  updateBusiness: (id: string, body: Partial<Business>) =>
    apiRequest<Business>(`/businesses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  customers: () => apiRequest<Customer[]>('/customers'),
  createCustomer: (body: Partial<Customer> & { businessId: string; name: string }) =>
    apiRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(body) }),
  updateCustomer: (id: string, body: Partial<Customer>) =>
    apiRequest<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCustomer: (id: string) => apiRequest<{ message: string }>(`/customers/${id}`, { method: 'DELETE' }),
  invoices: () => apiRequest<Invoice[]>('/invoices'),
  invoice: (id: string) => apiRequest<Invoice>(`/invoices/${id}`),
  createInvoice: (body: CreateInvoiceInput) =>
    apiRequest<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(body) }),
  updateInvoice: (id: string, body: UpdateInvoiceInput) =>
    apiRequest<Invoice>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteInvoice: (id: string) => apiRequest<{ message: string }>(`/invoices/${id}`, { method: 'DELETE' }),
  sendInvoice: (id: string) => apiRequest<{ message: string; invoice: Invoice }>(`/invoices/${id}/send`, { method: 'POST' }),
  markInvoicePaid: (id: string) => apiRequest<Invoice>(`/invoices/${id}/mark-paid`, { method: 'POST' }),
  invoicePayments: (invoiceId: string) => apiRequest<Payment[]>(`/payments/invoice/${invoiceId}`),
  manualPayment: (body: { invoiceId: string; amount: number; providerReference?: string }) =>
    apiRequest<Payment>('/payments/manual', { method: 'POST', body: JSON.stringify(body) }),
};
