import Link from 'next/link';
import { T } from '@/lib/i18n';
import { MIN_YEAR } from '@/lib/range';
import type { Lang, RangeKey } from '@/lib/types';

/** Períodos que tienen sentido para comparar países. */
export const STAT_RANGES = ['30d', '1y', 'year'] as const;
export type StatRange = (typeof STAT_RANGES)[number];
export const parseStatRange = (v: string | undefined): StatRange =>
  (STAT_RANGES as readonly string[]).includes(v ?? '') ? (v as StatRange) : '1y';

export function periodLabel(lang: Lang, range: RangeKey, year: number) {
  const t = T[lang];
  return range === 'year' ? String(year) : t.inRange[range] ?? range;
}

/** Selector de período sin JS: enlaces + formulario GET para el año. */
export function PeriodNav({ lang, path, range, year, params = {} }: {
  lang: Lang; path: string; range: StatRange; year: number; params?: Record<string, string>;
}) {
  const t = T[lang];
  const href = (r: StatRange) => {
    const p = new URLSearchParams({ ...params, ...(r === '1y' ? {} : { range: r }), ...(r === 'year' ? { year: String(year) } : {}) });
    const s = p.toString();
    return s ? `${path}?${s}` : path;
  };
  const years: number[] = [];
  for (let y = new Date().getFullYear(); y >= MIN_YEAR; y--) years.push(y);
  return (
    <div className="period-nav">
      <div className="seg" role="group" aria-label={t.period}>
        {STAT_RANGES.map((r) => (
          <Link key={r} href={href(r)} className={`seg-opt seg-link${r === range ? ' on' : ''}`} aria-current={r === range ? 'true' : undefined} scroll={false}>
            {t[`r${r}`]}
          </Link>
        ))}
      </div>
      {range === 'year' && (
        <form method="get" action={path} className="inline-6">
          {Object.entries(params).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input type="hidden" name="range" value="year" />
          <select name="year" defaultValue={year} className="input" aria-label={t.yearLabel} style={{ width: 'auto' }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-secondary" type="submit">{t.apply}</button>
        </form>
      )}
    </div>
  );
}
