'use client';

import { AuthProvider } from '../lib/auth';
import { ToastProvider } from '../components/toast-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider><AuthProvider>{children}</AuthProvider></ToastProvider>;
}
