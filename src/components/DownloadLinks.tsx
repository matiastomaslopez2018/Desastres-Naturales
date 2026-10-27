// Enlaces "Descargar: CSV · Excel" con los filtros de la lista que acompañan (ver lib/exportCsv).
import { exportHref, type ExportQuery } from '@/lib/exportCsv';

const T = {
  es: { label: 'Descargar estos datos', csv: 'CSV', excel: 'Excel', excelTitle: 'CSV con punto y coma y coma decimal, para Excel en español', csvTitle: 'CSV estándar (coma y punto decimal)' },
  en: { label: 'Download this data', csv: 'CSV', excel: 'Excel', excelTitle: 'CSV with semicolons and decimal commas, for Excel in Spanish', csvTitle: 'Standard CSV (comma and decimal point)' },
};

export function DownloadLinks({ q, className }: { q: Omit<ExportQuery, 'format'>; className?: string }) {
  const t = T[q.lang];
  return (
    <p className={`dl-links ${className ?? ''}`}>
      <span>⬇ {t.label}:</span>
      <a href={exportHref({ ...q, format: 'csv' })} download title={t.csvTitle}>{t.csv}</a>
      <a href={exportHref({ ...q, format: 'excel' })} download title={t.excelTitle}>{t.excel}</a>
    </p>
  );
}
