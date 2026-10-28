import { readFileSync } from 'node:fs';
import { readMiniseed } from '../../src/lib/server/miniseed';
const b = readFileSync('scripts/tmp/a.mseed'); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
// Control: Xn de cada registro = última muestra decodificada de ese registro.
let pos = 0, ok = 0, bad = 0;
while (pos < ab.byteLength) {
  const dv = new DataView(ab, pos), bo = dv.getUint16(46), len = 2 ** dv.getUint8(bo + 6), d = dv.getUint16(44), n = dv.getUint16(30);
  const one = readMiniseed(ab.slice(pos, pos + len))!;
  if (one.samples[n - 1] === dv.getInt32(d + 8)) ok++; else bad++;
  pos += len;
}
const tr = readMiniseed(ab)!;
console.log('records ok', ok, 'bad', bad, 'sps', tr.sps, 'n', tr.samples.length, 'expected', 30 * 60 * tr.sps, new Date(tr.start).toISOString(), Math.min(...tr.samples), Math.max(...tr.samples));
