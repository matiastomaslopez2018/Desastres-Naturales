'use client';
/*
 * Configurador del widget: se eligen país, tipo de evento, magnitud mínima, cantidad, período, idioma y tema;
 * se ve la vista previa y se copia el código para pegar en otro sitio.
 */
import { useMemo, useState } from 'react';
import { WIDGET_DEFAULT, WIDGET_TEXT, WIDGET_TYPES, widgetQuery, type WidgetParams } from '@/lib/widget';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';

const T = {
  es: {
    country: 'País', world: 'Todo el mundo', type: 'Qué mostrar', min: 'Magnitud mínima (sismos)', n: 'Cantidad', range: 'Período', wlang: 'Idioma del widget',
    theme: 'Colores', themes: { auto: 'Según el sistema', light: 'Claro', dark: 'Oscuro' }, ranges: { '24h': '24 horas', '7d': '7 días', '30d': '30 días' },
    preview: 'Vista previa', code: 'Código para pegar en tu sitio', copy: 'Copiar código', copied: 'Copiado', codeHelp: 'Pegalo donde quieras que aparezca. El script ajusta el alto del widget solo; sin él, el widget se ve igual con un alto fijo.',
  },
  en: {
    country: 'Country', world: 'Worldwide', type: 'What to show', min: 'Minimum magnitude (earthquakes)', n: 'How many', range: 'Period', wlang: 'Widget language',
    theme: 'Colors', themes: { auto: 'Match the system', light: 'Light', dark: 'Dark' }, ranges: { '24h': '24 hours', '7d': '7 days', '30d': '30 days' },
    preview: 'Preview', code: 'Code to paste on your site', copy: 'Copy code', copied: 'Copied', codeHelp: 'Paste it wherever you want it to appear. The script adjusts the widget height; without it, the widget still works with a fixed height.',
  },
};

export function WidgetBuilder({ lang, site, countries }: { lang: Lang; site: string; countries: { iso3: string; name: string }[] }) {
  const t = T[lang], w = WIDGET_TEXT[lang];
  const [p, setP] = useState<WidgetParams>({ ...WIDGET_DEFAULT, lang, country: lang === 'es' ? 'ARG' : null });
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<WidgetParams>) => { setCopied(false); setP((x) => ({ ...x, ...patch })); };
  const q = widgetQuery(p);
  const title = `${w.types[p.type]} · Mapa de Desastres`;
  const code = useMemo(() => `<iframe src="${site}/embed?${q.replace(/&/g, '&amp;')}" title="${title}" width="100%" height="460" style="border:0;max-width:520px" loading="lazy"></iframe>\n<script async src="${site}/embed.js"></script>`, [site, q, title]);
  return (
    <div className="wb">
      <form className="wb-form" onSubmit={(e) => e.preventDefault()}>
        <label className="qs-field"><span>{t.country}</span>
          <select className="vs-select" value={p.country ?? ''} onChange={(e) => set({ country: e.target.value || null })}>
            <option value="">{t.world}</option>
            {countries.map((c) => <option key={c.iso3} value={c.iso3}>{c.name}</option>)}
          </select>
        </label>
        <label className="qs-field"><span>{t.type}</span>
          <select className="vs-select" value={p.type} onChange={(e) => set({ type: e.target.value as WidgetParams['type'] })}>
            {WIDGET_TYPES.map((k) => <option key={k} value={k}>{w.types[k]}</option>)}
          </select>
        </label>
        {(p.type === 'eq' || p.type === 'all') && (
          <label className="qs-field"><span>{t.min}</span>
            <select className="vs-select" value={p.min} onChange={(e) => set({ min: +e.target.value })}>
              {[2.5, 3, 4, 4.5, 5, 6].map((m) => <option key={m} value={m}>M{fmtNum(lang, m, 1)}+</option>)}
            </select>
          </label>
        )}
        <label className="qs-field"><span>{t.range}</span>
          <select className="vs-select" value={p.range} onChange={(e) => set({ range: e.target.value as WidgetParams['range'] })}>
            {(['24h', '7d', '30d'] as const).map((r) => <option key={r} value={r}>{t.ranges[r]}</option>)}
          </select>
        </label>
        <label className="qs-field"><span>{t.n}</span>
          <select className="vs-select" value={p.n} onChange={(e) => set({ n: +e.target.value })}>
            {[5, 8, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="qs-field"><span>{t.wlang}</span>
          <select className="vs-select" value={p.lang} onChange={(e) => set({ lang: e.target.value as Lang })}>
            <option value="es">Español</option><option value="en">English</option>
          </select>
        </label>
        <label className="qs-field"><span>{t.theme}</span>
          <select className="vs-select" value={p.theme} onChange={(e) => set({ theme: e.target.value as WidgetParams['theme'] })}>
            {(['auto', 'light', 'dark'] as const).map((k) => <option key={k} value={k}>{t.themes[k]}</option>)}
          </select>
        </label>
      </form>
      <div className="wb-out">
        <h2 className="qs-h">{t.preview}</h2>
        <iframe key={q} className="wb-frame" src={`/embed?${q}`} title={title} loading="lazy" />
        <h2 className="qs-h">{t.code}</h2>
        <textarea className="wb-code" readOnly value={code} rows={4} onFocus={(e) => e.currentTarget.select()} />
        <div className="wb-actions">
          <button type="button" className="ed-button" onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => {})}>{copied ? t.copied : t.copy}</button>
        </div>
        <p className="ed-note">{t.codeHelp}</p>
      </div>
    </div>
  );
}
