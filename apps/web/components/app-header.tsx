'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';

const links = ['dashboard', 'customers', 'invoices', 'settings'];

export function AppHeader() {
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <header>
      <Link href="/" className="brand">Billora</Link>
      <nav>
        {user ? (
          <>
            {links.map((link) => <Link key={link} href={`/${link}`}>{link[0].toUpperCase() + link.slice(1)}</Link>)}
            <button className="link-button" type="button" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <Link href="/login">Log in</Link>
            <Link href="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
