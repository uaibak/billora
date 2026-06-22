import Link from 'next/link';
import './globals.css';

export const metadata = { title: 'Billora', description: 'Simple invoicing for growing businesses' };
const links = ['dashboard', 'customers', 'invoices', 'settings'];
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><header><Link href="/"><strong>Billora</strong></Link><nav>{links.map((link) => <Link key={link} href={`/${link}`}>{link[0].toUpperCase() + link.slice(1)}</Link>)}</nav></header><main>{children}</main></body></html>;
}
