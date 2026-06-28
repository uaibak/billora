import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMoney, inDays, today } from '../lib/format';
import { getSafeRedirectPath } from '../lib/errors';
import { validateEmail, validateInvoiceItems, validatePassword } from '../lib/validators';

test('validates safe redirect paths', () => {
  assert.equal(getSafeRedirectPath('/dashboard'), '/dashboard');
  assert.equal(getSafeRedirectPath('//evil.example'), '/dashboard');
  assert.equal(getSafeRedirectPath('https://evil.example'), '/dashboard');
  assert.equal(getSafeRedirectPath(null), '/dashboard');
});

test('validates auth and invoice form inputs', () => {
  assert.equal(validateEmail('umar@example.com'), true);
  assert.equal(validateEmail('bad-email'), false);
  assert.equal(validatePassword('Password123'), '');
  assert.match(validatePassword('short'), /at least 8/);
  assert.equal(validateInvoiceItems([{ description: 'Design', quantity: 1, unitPrice: 100, taxRate: 0 }]), '');
  assert.match(validateInvoiceItems([{ description: '', quantity: 1, unitPrice: 100, taxRate: 0 }]), /description/);
});

test('formats money and dates predictably', () => {
  assert.equal(formatMoney(1250), '$1,250.00');
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(inDays(14), /^\d{4}-\d{2}-\d{2}$/);
});
