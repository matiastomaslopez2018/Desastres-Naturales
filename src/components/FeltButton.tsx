'use client';
/*
 * "¿Lo sentiste?": la persona elige cómo sintió el sismo (y, si quiere, suma su ubicación aproximada); se
 * muestra lo que reportaron los demás y se enlaza al formulario oficial (INPRES o USGS).
 */
import { useEffect, useState } from 'react';
import { FELT_BANDS, FELT_DAYS, FELT_MMI, FELT_TEXT, romanOf, type FeltSummary } from '@/lib/felt';
import { fmtNum } from '@/lib/format';
import type { LocalReport, Lang } from '@/lib/types';

const KEY = 'atlas-felt';
const sent = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const markSent = (id: string) => { try { const s = sent(); s[id] = Date.now(); for (const k of Object.keys(s)) if (Date.now() - s[k] > FELT_DAYS * 864e5) delete s[k]; localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ } };

type Props = { lang: Lang; id: string; time: number; usgs: boolean; local: LocalReport[] };

export function FeltButton({ lang, id, time, usgs, local }: Props) {
  const t = FELT_TEXT[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const open = Date.now() - time < FELT_DAYS * 864e5;
  const [sum, setSum] = useState<FeltSummary | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [withLoc, setWithLoc] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'already' | 'failed'>('idle');
  useEffect(() => {
    if (sent()[id]) setState('already');
    let ok = true;
    fetch(`/api/felt?id=${encodeURIComponent(id)}`).then((r) => r.json()).then((j: FeltSummary) => { if (ok && 'total' in j) setSum(j); }).catch(() => {});
    return () => { ok = false; };
  }, [id]);

  const send = async () => {
    if (level == null) return;
    setState('sending');
    let pos: { lat: number; lon: number } | null = null;
    if (withLoc && level > 0 && 'geolocation' in navigator) {
      pos = await new Promise((res) => navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: Math.round(p.coords.latitude * 10) / 10, lon: Math.round(p.coords.longitude * 10) / 10 }), () => res(null), { timeout: 15000, maximumAge: 600000 }));
    }
    try {
      const r = await fetch('/api/felt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, level, lat: pos?.lat ?? null, lon: pos?.lon ?? null }) });
      if (r.status === 409) { markSent(id); setState('already'); return; }
      if (!r.ok) { setState('failed'); return; }
      setSum(await r.json()); markSent(id); setState('done');
    } catch { setState('failed'); }
  };

  const felt = sum ? sum.total - sum.byLevel[0] : 0;
  const mode = sum && felt ? sum.byLevel.slice(1).indexOf(Math.max(...sum.byLevel.slice(1))) + 1 : null;
  const inpres = local.find((l) => l.agency === 'INPRES');
  const usgsUrl = usgs ? `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(id)}/tellus` : null;

  return (
    <section className="felt" aria-labelledby="felt-h">
      <h2 id="felt-h" className="ed-h3">{t.title}</h2>
      {open && state !== 'done' && state !== 'already' && (
        <>
          <p className="ed-note">{t.intro}</p>
          <div className="felt-opts" role="radiogroup" aria-labelledby="felt-h">
            {t.levels.map(([name, desc], k) => (
              <button key={k} type="button" role="radio" aria-checked={level === k} className={`felt-opt felt-l${k}`} onClick={() => setLevel(k)}>
                <b>{name}</b>{desc && <span>{desc}</span>}
              </button>
            ))}
          </div>
          {level != null && (
            <div className="felt-send">
              {level > 0 && (
                <label className="felt-loc"><input type="checkbox" checked={withLoc} onChange={(e) => setWithLoc(e.target.checked)} /> {t.where}<span className="qs-help"> {t.whereHelp}</span></label>
              )}
              <button type="button" className="ed-button felt-go" onClick={send} disabled={state === 'sending'}>{state === 'sending' ? t.sending : t.send}</button>
              {state === 'failed' && <p className="qs-warn">{t.failed}</p>}
            </div>
          )}
        </>
      )}
      {state === 'done' && <p className="felt-ok">{t.thanks}</p>}
      {state === 'already' && <p className="ed-note">{t.already}</p>}
      {!open && <p className="ed-note">{t.closed}</p>}

      {sum && (sum.total ? (
        <div className="felt-res">
          <p className="felt-total">{t.results(nf(sum.total))}{mode != null ? ` · ${t.typical(`${t.levels[mode][0].toLowerCase()} (${romanOf(FELT_MMI[mode])})`)}` : ''}</p>
          <ul className="felt-bars">
            {t.levels.map(([name], k) => {
              const n = sum.byLevel[k], w = sum.total ? (100 * n) / sum.total : 0;
              return <li key={k}><span>{name}</span><i><b className={`felt-l${k}`} style={{ width: `${w}%` }} /></i><span>{nf(n)}</span></li>;
            })}
          </ul>
          {sum.located > 0 && (
            <>
              <h3 className="qs-h3">{t.byDist}</h3>
              <ul className="felt-dist">
                {sum.bands.filter((b) => b.n).map((b) => {
                  const i = FELT_BANDS.indexOf(b.maxKm), lo = i ? FELT_BANDS[i - 1] : 0;
                  const label = !i ? t.firstBand(nf(b.maxKm)) : Number.isFinite(b.maxKm) ? t.band(nf(lo), nf(b.maxKm)) : t.band(nf(lo), null);
                  return <li key={b.maxKm}><b>{label}</b> · {nf(b.n)} · {t.avg(romanOf(b.mmi!))}</li>;
                })}
              </ul>
            </>
          )}
        </div>
      ) : <p className="ed-note">{t.none}</p>)}

      {(inpres || usgsUrl) && (
        <p className="felt-official">
          <span>{t.official}:</span>
          {inpres && <a href={inpres.url} target="_blank" rel="noopener noreferrer">{t.inpres} ↗</a>}
          {usgsUrl && <a href={usgsUrl} target="_blank" rel="noopener noreferrer">{t.usgs} ↗</a>}
        </p>
      )}
      <p className="qs-help">{t.note}</p>
    </section>
  );
}
