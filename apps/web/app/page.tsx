import Link from 'next/link';

export default function Home() {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Billora</p>
        <h1>Invoices without the friction.</h1>
        <p>Manage your business profile, customers, invoices, and manual payments from one clean workspace.</p>
        <div className="actions">
          <Link className="button" href="/login">Log in</Link>
          <Link className="button secondary" href="/register">Create account</Link>
        </div>
      </div>
      <div className="card stats-card">
        <span>Backend connected</span>
        <strong>JWT + Prisma + PostgreSQL</strong>
        <p>Create an account, set up your business, and start managing invoices.</p>
      </div>
    </section>
  );
}
