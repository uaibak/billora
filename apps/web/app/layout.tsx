import './globals.css';
import { AppHeader } from '../components/app-header';
import { Providers } from './providers';

export const metadata = { title: 'Billora', description: 'Simple invoicing for growing businesses' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppHeader />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
