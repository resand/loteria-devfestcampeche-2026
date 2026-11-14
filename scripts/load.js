// Prueba de carga: N jugadores simulados hacen todo el flujo (SSE, créditos, carta, tabla, ¡Lotería!).
// Uso: node scripts/load.js [url] [jugadores]   — requiere invitados (local, o ALLOW_GUEST=1 en la nube).
// En modo real (con Gemini) cada carta cuesta: úsalo con MOCK o baja el número de jugadores.
import sharp from 'sharp';

const URL = process.argv[2] || 'http://localhost:8080', N = +process.argv[3] || 400;
const selfie = (await sharp({ create: { width: 400, height: 500, channels: 3, background: '#C3ECF6' } }).jpeg().toBuffer()).toString('base64');
const archetype = (await (await fetch(URL + '/api/config')).json()).archetypes[0]; // una carta válida, la que sea
const now = () => performance.now();

async function call(path, body, cookie) {
  const r = await fetch(URL + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', cookie: cookie || '' }, body: body && JSON.stringify(body) });
  return { r, j: await r.json().catch(() => ({})) };
}

// host = un invitado más (en local todos son host)
const host = (path, body = {}) => call('/api/host/' + path, body, players[0].cookie);
const players = [];
let latencies = [], calledAt = null;

console.log(`→ ${N} jugadores contra ${URL}`);
await Promise.all(Array.from({ length: N }, async (_, i) => {
  const { r } = await call('/api/guest', { name: `Bot ${i}` });
  const p = { cookie: r.headers.get('set-cookie').split(';')[0], i };
  players.push(p);
  // escuchar el SSE como lo hace el celular y medir cuánto tarda en llegar cada carta cantada
  const res = await fetch(URL + '/api/stream', { headers: { cookie: p.cookie } });
  const reader = res.body.getReader(), decoder = new TextDecoder();
  (async () => {
    let buf = '', seen = 0;
    for (;;) {
      const { value, done } = await reader.read(); if (done) return;
      buf += decoder.decode(value);
      for (let k; (k = buf.indexOf('\n\n')) >= 0; ) {
        const line = buf.slice(0, k); buf = buf.slice(k + 2);
        if (!line.startsWith('data: ')) continue;
        const s = JSON.parse(line.slice(6));
        if (s.sung.length > seen && calledAt) { seen = s.sung.length; latencies.push(now() - calledAt); }
      }
    }
  })();
}));
console.log(`✓ ${players.length} conectados por SSE`);

await host('phase', { phase: 'cards' });
const t0 = now();
await Promise.all(players.map(async (p) => { await call('/api/credits', {}, p.cookie); await call('/api/card', { selfie, archetype, name: `Bot ${p.i}` }, p.cookie); }));
for (;;) { const s = await (await fetch(URL + '/api/host/cards', { headers: { cookie: players[0].cookie } })).json(); if (s.length >= N) break; await new Promise((r) => setTimeout(r, 500)); }
console.log(`✓ ${N} cartas hechas en ${((now() - t0) / 1000).toFixed(1)} s (modo ensayo; con Gemini depende de la cuota)`);

await host('phase', { phase: 'deck' });
console.log('✓ mazo:', (await host('deck')).j);
await Promise.all(players.map(async (p) => { p.board = (await call('/api/me', null, p.cookie)).j.board.map((c) => c.id); }));
await host('phase', { phase: 'game' });

let winners = 0;
for (let k = 0; k < 54 && !winners; k++) {
  latencies = []; calledAt = now();
  const { j } = await host('call');
  await new Promise((r) => setTimeout(r, 400));
  const p50 = latencies.sort((a, b) => a - b)[latencies.length >> 1] | 0, p99 = latencies[Math.floor(latencies.length * 0.99)] | 0;
  // todos gritan ¡Lotería! (los que no tienen línea reciben “Aún no”: valida que el servidor rechace trampas)
  const rs = await Promise.all(players.map((p) => call('/api/claim', {}, p.cookie)));
  winners = rs.filter((x) => x.r.ok).length;
  console.log(`carta ${k + 1} (${j.id}): ${latencies.length}/${N} la recibieron · p50 ${p50} ms · p99 ${p99} ms · ganadores ${winners}`);
}
console.log(`✓ fin: ${winners} ganador(es) válidos.`);
await host('phase', { phase: 'results' });
process.exit(0);
