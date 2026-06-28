import type { AuditLog, Business, Customer, DashboardSummary, Invoice, Organization, OrganizationInvite, OrganizationMember, Payment, User } from '@billora/shared';

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
export type PaginationMeta = { page: number; limit: number; total: number; totalPages: number };
export type PaginatedResponse<T> = { data: T[]; meta: PaginationMeta };
export type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  organizationId?: string;
  businessId?: string;
  customerId?: string;
  status?: string;
  provider?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
};

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
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    if (response.status === 401 && typeof window !== 'undefined') {
      clearToken();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(message || `Request failed with status ${response.status}`, response.status, data);
  }

  return data as T;
}

function queryString(query?: ListQuery) {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : '';
}

async function listRequest<T>(path: string, query?: ListQuery) {
  return apiRequest<PaginatedResponse<T>>(`${path}${queryString(query)}`);
}

async function fileRequest(path: string, formData: FormData) {
  return apiRequest<Business>(path, { method: 'POST', body: formData });
}

export const api = {
  login: (body: { email: string; password: string }) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body: { fullName: string; email: string; password: string }) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => apiRequest<{ message: string }>('/auth/logout', { method: 'POST' }),
  me: () => apiRequest<User>('/auth/me'),
  organizations: () => apiRequest<Organization[]>('/organizations'),
  createOrganization: (body: { name: string }) =>
    apiRequest<Organization>('/organizations', { method: 'POST', body: JSON.stringify(body) }),
  updateOrganization: (id: string, body: { name?: string }) =>
    apiRequest<Organization>(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  organizationMembers: (id: string) => apiRequest<OrganizationMember[]>(`/organizations/${id}/members`),
  organizationInvites: (id: string) => apiRequest<OrganizationInvite[]>(`/organizations/${id}/invites`),
  createOrganizationInvite: (id: string, body: { email: string; role?: string }) =>
    apiRequest<OrganizationInvite>(`/organizations/${id}/invites`, { method: 'POST', body: JSON.stringify(body) }),
  cancelOrganizationInvite: (organizationId: string, inviteId: string) =>
    apiRequest<OrganizationInvite>(`/organizations/${organizationId}/invites/${inviteId}`, { method: 'DELETE' }),
  resendOrganizationInvite: (organizationId: string, inviteId: string) =>
    apiRequest<OrganizationInvite>(`/organizations/${organizationId}/invites/${inviteId}/resend`, { method: 'POST' }),
  acceptOrganizationInvite: (token: string) =>
    apiRequest<OrganizationInvite>('/organizations/invites/accept', { method: 'POST', body: JSON.stringify({ token }) }),
  auditLogsPaginated: (query: ListQuery & { organizationId: string }) => listRequest<AuditLog>('/audit-logs', query),
  auditExportUrl: (query: ListQuery & { organizationId: string }) => `${API_URL}/audit-logs/export${queryString(query)}`,
  dashboardSummary: (organizationId?: string) => apiRequest<DashboardSummary>(`/dashboard/summary${queryString({ organizationId })}`),
  businessesPaginated: (query?: ListQuery) => listRequest<Business>('/businesses', query),
  businesses: async (query?: ListQuery) => (await listRequest<Business>('/businesses', query)).data,
  createBusiness: (body: Partial<Business> & { name: string }) =>
    apiRequest<Business>('/businesses', { method: 'POST', body: JSON.stringify(body) }),
  updateBusiness: (id: string, body: Partial<Business>) =>
    apiRequest<Business>(`/businesses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteBusiness: (id: string) => apiRequest<{ message: string }>(`/businesses/${id}`, { method: 'DELETE' }),
  uploadBusinessLogo: (id: string, file: File) => {
    const formData = new FormData();
    formData.set('logo', file);
    return fileRequest(`/businesses/${id}/logo`, formData);
  },
  customersPaginated: (query?: ListQuery) => listRequest<Customer>('/customers', query),
  customers: async (query?: ListQuery) => (await listRequest<Customer>('/customers', query)).data,
  createCustomer: (body: Partial<Customer> & { businessId: string; name: string }) =>
    apiRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(body) }),
  updateCustomer: (id: string, body: Partial<Customer>) =>
    apiRequest<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCustomer: (id: string) => apiRequest<{ message: string }>(`/customers/${id}`, { method: 'DELETE' }),
  invoicesPaginated: (query?: ListQuery) => listRequest<Invoice>('/invoices', query),
  invoices: async (query?: ListQuery) => (await listRequest<Invoice>('/invoices', query)).data,
  invoice: (id: string) => apiRequest<Invoice>(`/invoices/${id}`),
  createInvoice: (body: CreateInvoiceInput) =>
    apiRequest<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(body) }),
  updateInvoice: (id: string, body: UpdateInvoiceInput) =>
    apiRequest<Invoice>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteInvoice: (id: string) => apiRequest<{ message: string }>(`/invoices/${id}`, { method: 'DELETE' }),
  sendInvoice: (id: string) => apiRequest<{ message: string; invoice: Invoice; job?: { queued: boolean; jobId?: string; reason?: string } }>(`/invoices/${id}/send`, { method: 'POST' }),
  generateInvoicePdf: (id: string) => apiRequest<{ message: string; invoice?: Invoice; job?: { queued: boolean; jobId?: string; reason?: string } }>(`/invoices/${id}/pdf`, { method: 'POST' }),
  markInvoicePaid: (id: string) => apiRequest<Invoice>(`/invoices/${id}/mark-paid`, { method: 'POST' }),
  invoicePaymentsPaginated: (invoiceId: string, query?: ListQuery) => listRequest<Payment>(`/payments/invoice/${invoiceId}`, query),
  invoicePayments: async (invoiceId: string, query?: ListQuery) => (await listRequest<Payment>(`/payments/invoice/${invoiceId}`, query)).data,
  manualPayment: (body: { invoiceId: string; amount: number; providerReference?: string }) =>
    apiRequest<Payment>('/payments/manual', { method: 'POST', body: JSON.stringify(body) }),
};
