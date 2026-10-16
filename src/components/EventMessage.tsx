import Link from 'next/link';

export function EventMessage({ title, text, href, back, action }: { title: string; text: string; href: string; back: string; action?: React.ReactNode }) {
  return (
    <main className="event-message">
      <div className="card blueprint" style={{ padding: 24, gap: 12, maxWidth: 520 }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <h1 style={{ margin: 0, fontSize: 32, textTransform: 'uppercase' }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{text}</p>
        <div className="inline-6" style={{ gap: 12 }}>
          <Link href={href} className="btn btn-secondary">{back}</Link>
          {action}
        </div>
      </div>
    </main>
  );
}
