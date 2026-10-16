import Link from 'next/link';

/** Mensaje de página completa (404 o fuente caída) en estilo editorial. */
export function EventMessage({ title, text, href, back, action }: { title: string; text: string; href: string; back: string; action?: React.ReactNode }) {
  return (
    <div className="theme-paper ed-page">
      <main className="ed-message">
        <div className="ed-message-box">
          <h1 className="ed-headline">{title}</h1>
          <p className="ed-dek">{text}</p>
          <div className="row" style={{ gap: 12 }}>
            <Link href={href} className="ed-button">{back}</Link>
            {action}
          </div>
        </div>
      </main>
    </div>
  );
}
