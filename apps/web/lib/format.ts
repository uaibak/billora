export function formatMoney(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
