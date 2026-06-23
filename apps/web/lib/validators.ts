import type { InvoiceInputItem } from './api';

export function validateEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validatePassword(value: string) {
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter.';
  if (!/\d/.test(value)) return 'Password must include a number.';
  return '';
}

export function validateInvoiceItems(items: InvoiceInputItem[]) {
  if (!items.length) return 'Add at least one invoice item.';
  const invalidDescription = items.some((item) => !item.description.trim());
  if (invalidDescription) return 'Every invoice item needs a description.';
  const invalidAmount = items.some((item) => Number(item.quantity) <= 0 || Number(item.unitPrice) < 0 || Number(item.taxRate) < 0);
  if (invalidAmount) return 'Invoice item quantities, prices, and tax rates must be valid positive numbers.';
  return '';
}
