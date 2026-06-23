'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../lib/auth';

export function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, pathname, router, user]);

  if (loading) {
    return <section className="card"><p>Loading your Billora workspace...</p></section>;
  }

  if (!user) {
    return (
      <section className="card narrow">
        <h1>Log in required</h1>
        <p>Please log in to manage your Billora workspace.</p>
        <Link className="button" href={`/login?next=${encodeURIComponent(pathname)}`}>Go to login</Link>
      </section>
    );
  }

  return <>{children}</>;
}
