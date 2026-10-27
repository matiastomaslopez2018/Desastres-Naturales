'use client';
/*
 * Partes interactivas de "Qué hacer": teléfonos de emergencia del país, la mochila de emergencia para tildar
 * y el plan familiar para completar e imprimir. Todo se guarda solo en este navegador (localStorage).
 */
import { useEffect, useState } from 'react';
import { AGENCIES, KIT } from '@/lib/guides';
import type { Lang } from '@/lib/types';

const T = {
  es: {
    country: 'Tu país', numbers: 'Teléfonos de emergencia', agency: 'Protección civil', noPhones: 'Consultá los números de emergencia en el sitio de protección civil.',
    kit: 'Mochila de emergencia', kitHelp: 'Tildá lo que ya tenés. Se guarda solo en este navegador.', done: (a: number, b: number) => `${a} de ${b} listos`, reset: 'Empezar de nuevo',
    plan: 'Plan familiar', planHelp: 'Completalo con tu familia e imprimilo. Se guarda solo en este navegador: no se envía a ningún lado.',
    fields: [
      ['meetNear', 'Punto de encuentro cerca de casa', 'Por ejemplo: la plaza de la esquina'],
      ['meetFar', 'Punto de encuentro fuera del barrio', 'Por si no se puede volver a casa'],
      ['contact', 'Contacto fuera de la zona (nombre y teléfono)', 'Alguien que no esté en la misma zona'],
      ['people', 'Quiénes viven en casa y sus teléfonos', ''],
      ['health', 'Medicamentos, alergias y necesidades especiales', ''],
      ['utilities', 'Dónde se cortan el gas, la luz y el agua', ''],
      ['pets', 'Mascotas y quién las lleva', ''],
    ] as [string, string, string][],
    print: 'Imprimir el plan y la mochila', clear: 'Borrar el plan',
  },
  en: {
    country: 'Your country', numbers: 'Emergency numbers', agency: 'Civil protection', noPhones: 'Check the emergency numbers on the civil protection website.',
    kit: 'Emergency kit', kitHelp: 'Tick what you already have. It is saved only in this browser.', done: (a: number, b: number) => `${a} of ${b} ready`, reset: 'Start over',
    plan: 'Family plan', planHelp: 'Fill it in with your family and print it. It is saved only in this browser: nothing is sent anywhere.',
    fields: [
      ['meetNear', 'Meeting place near home', 'For example: the park on the corner'],
      ['meetFar', 'Meeting place outside the neighborhood', 'In case you cannot get home'],
      ['contact', 'Out-of-area contact (name and phone)', 'Someone who is not in the same area'],
      ['people', 'Who lives at home and their phone numbers', ''],
      ['health', 'Medicines, allergies and special needs', ''],
      ['utilities', 'Where to shut off gas, power and water', ''],
      ['pets', 'Pets and who takes them', ''],
    ],
    print: 'Print the plan and the kit', clear: 'Clear the plan',
  },
};

const load = <V,>(k: string, d: V): V => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as V) : d; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

/** País probable por la zona horaria del navegador (solo para elegir el país al abrir; se puede cambiar). */
const TZ: [RegExp, string][] = [
  [/^America\/Argentina\//, 'ARG'], [/^America\/(Santiago|Punta_Arenas)|^Pacific\/Easter/, 'CHL'], [/^America\/(Mexico_City|Monterrey|Merida|Cancun|Tijuana|Chihuahua|Hermosillo|Mazatlan|Bahia_Banderas|Matamoros|Ojinaga)/, 'MEX'],
  [/^America\/Lima/, 'PER'], [/^America\/Guayaquil|^Pacific\/Galapagos/, 'ECU'], [/^America\/Bogota/, 'COL'], [/^America\/La_Paz/, 'BOL'], [/^America\/Montevideo/, 'URY'],
  [/^America\/Asuncion/, 'PRY'], [/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Maceio|Araguaina|Santarem|Noronha)/, 'BRA'],
  [/^America\/Guatemala/, 'GTM'], [/^America\/El_Salvador/, 'SLV'], [/^America\/Tegucigalpa/, 'HND'], [/^America\/Managua/, 'NIC'], [/^America\/Costa_Rica/, 'CRI'],
  [/^America\/Panama/, 'PAN'], [/^America\/Santo_Domingo/, 'DOM'], [/^America\/Puerto_Rico/, 'PRI'], [/^Europe\/Madrid|^Atlantic\/Canary|^Africa\/Ceuta/, 'ESP'], [/^Asia\/Tokyo/, 'JPN'],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise)|^Pacific\/Honolulu/, 'USA'],
];

const A2: Record<string, string> = { ARG: 'AR', CHL: 'CL', MEX: 'MX', PER: 'PE', ECU: 'EC', COL: 'CO', BOL: 'BO', URY: 'UY', PRY: 'PY', BRA: 'BR', GTM: 'GT', SLV: 'SV', HND: 'HN', NIC: 'NI', CRI: 'CR', PAN: 'PA', DOM: 'DO', USA: 'US', PRI: 'PR', ESP: 'ES', JPN: 'JP' };
const regionName = (lang: Lang, iso3: string) => { try { return new Intl.DisplayNames([lang], { type: 'region' }).of(A2[iso3] ?? iso3) ?? iso3; } catch { return iso3; } };

export function CountryPhones({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [iso, setIso] = useState('ARG');
  useEffect(() => {
    const saved = load<string | null>('atlas-guide-country', null);
    if (saved && AGENCIES[saved]) { setIso(saved); return; }
    try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; const m = TZ.find(([re]) => re.test(tz)); if (m) setIso(m[1]); } catch { /* sin zona horaria */ }
  }, []);
  const a = AGENCIES[iso];
  const list = Object.keys(AGENCIES).map((k) => ({ k, name: regionName(lang, k) })).sort((x, y) => x.name.localeCompare(y.name, lang));
  return (
    <div className="prep-phones">
      <label className="qs-field">
        <span>{t.country}</span>
        <select className="vs-select" value={iso} onChange={(e) => { setIso(e.target.value); save('atlas-guide-country', e.target.value); }}>
          {list.map((c) => <option key={c.k} value={c.k}>{c.name}</option>)}
        </select>
      </label>
      <div>
        <p className="prep-h">{t.numbers}</p>
        {a.phones ? <p className="prep-tels">{a.phones.map((p) => <a key={p.n} href={`tel:${p.n}`} className="guide-tel">{p.n} <small>{p[lang]}</small></a>)}</p> : <p className="ed-note">{t.noPhones}</p>}
        <p className="ed-note">{t.agency}: <a href={a.url} target="_blank" rel="noopener noreferrer">{a.name} ↗</a></p>
      </div>
    </div>
  );
}

export function Kit({ lang }: { lang: Lang }) {
  const t = T[lang], groups = KIT[lang];
  const all = groups.flatMap((g, gi) => g.items.map((_, i) => `${gi}-${i}`));
  const [have, setHave] = useState<string[]>([]);
  useEffect(() => { setHave(load<string[]>('atlas-kit', [])); }, []);
  const toggle = (k: string) => setHave((h) => { const n = h.includes(k) ? h.filter((x) => x !== k) : [...h, k]; save('atlas-kit', n); return n; });
  const n = have.filter((k) => all.includes(k)).length;
  return (
    <section className="prep print-area" aria-labelledby="kit-h">
      <h2 id="kit-h" className="ed-h3">{t.kit}</h2>
      <p className="ed-note no-print">{t.kitHelp}</p>
      <div className="prep-progress" aria-hidden="true"><i style={{ width: `${(100 * n) / all.length}%` }} /></div>
      <p className="prep-count">{t.done(n, all.length)}</p>
      <div className="prep-kit">
        {groups.map((g, gi) => (
          <fieldset key={g.title}>
            <legend>{g.title}</legend>
            {g.items.map((it, i) => {
              const k = `${gi}-${i}`;
              return <label key={k} className="prep-item"><input type="checkbox" checked={have.includes(k)} onChange={() => toggle(k)} /> {it}</label>;
            })}
          </fieldset>
        ))}
      </div>
      {n > 0 && <button type="button" className="ml-share no-print" onClick={() => { setHave([]); save('atlas-kit', []); }}>{t.reset}</button>}
    </section>
  );
}

export function FamilyPlan({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [plan, setPlan] = useState<Record<string, string>>({});
  useEffect(() => { setPlan(load<Record<string, string>>('atlas-plan', {})); }, []);
  const set = (k: string, v: string) => setPlan((p) => { const n = { ...p, [k]: v }; save('atlas-plan', n); return n; });
  return (
    <section className="prep print-area" aria-labelledby="plan-h">
      <h2 id="plan-h" className="ed-h3">{t.plan}</h2>
      <p className="ed-note no-print">{t.planHelp}</p>
      <div className="prep-plan">
        {t.fields.map(([k, label, ph]) => (
          <label key={k} className="prep-field">
            <span>{label}</span>
            <textarea rows={2} value={plan[k] ?? ''} placeholder={ph} onChange={(e) => set(k, e.target.value)} maxLength={600} />
          </label>
        ))}
      </div>
      <div className="prep-actions no-print">
        <button type="button" className="ed-button" onClick={() => window.print()}>🖨 {t.print}</button>
        <button type="button" className="ml-share" onClick={() => { setPlan({}); save('atlas-plan', {}); }}>{t.clear}</button>
      </div>
    </section>
  );
}
