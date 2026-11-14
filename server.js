// Lotería DevFest Campeche — un solo servidor: API, tiempo real (SSE) y las 3 vistas.
// ponytail: estado en memoria + respaldo JSON; requiere Cloud Run con max-instances=1 (aguanta los ~400 del taller).
import express from 'express';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { OAuth2Client } from 'google-auth-library';
import QRCode from 'qrcode';
import { save, load, removeAll } from './store.js';
import { MOCK, ARCHETYPES, cardArt, verse, tts, fakeArt } from './gemini.js';
import { buildDeck, deal, nextCard, wins } from './game.js';

const env = process.env;
const CLIENT_ID = env.GOOGLE_CLIENT_ID || '';
const GUEST = !CLIENT_ID || env.ALLOW_GUEST === '1'; // invitados: local o prueba de carga
const HOSTS = (env.HOST_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const SECRET = env.SESSION_SECRET || 'local-dev';
const WORKERS = +env.CONCURRENCY || 6;
const MAX_CARDS = +env.MAX_CARDS || 600; // ~$0.034 c/u con Nano Banana 2.1 a 1K
export const PHASES = ['welcome', 'credits', 'creditsGuide', 'deploy', 'sse', 'sseDemo', 'cards', 'deck', 'game', 'results', 'repo'];

const fresh = () => ({ phase: 'welcome', mode: 'line', users: {}, cards: {}, deck: [], sung: [], winners: [], n: 0, round: 0, gameStart: 0, gameEnd: null, present: {} });
let S = fresh();
const saved = await load('state.json');
if (saved) S = { ...S, ...JSON.parse(saved) };
if (!PHASES.includes(S.phase)) S = fresh(); // respaldo de una versión anterior del estado: empezar limpio

let saveTimer;
const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => save('state.json', JSON.stringify(S)).catch(console.error), 1500); };

// Link de canje vigente: el principal, o el de respaldo si el host lo activó (se acabaron los canjes o falla)
const creditsUrl = () => (S.creditsBackup && env.CREDITS_URL_BACKUP) || env.CREDITS_URL || '';

// ---------- tiempo real ----------
const clients = new Set();
let recentPresent = []; // últimos “¡Presente!” (nombre y hora) para que el proyector los anime
const meta = (c) => c && { id: c.id, n: c.n, title: c.title, verse: c.verse, name: c.name, audio: !!c.audio };
const snapshot = () => {
  const users = Object.values(S.users), cards = Object.values(S.cards).filter((c) => !c.hidden);
  return {
    phase: S.phase, mode: S.mode, mock: MOCK, round: S.round, voicesBusy, guideStep: S.guideStep || 0, creditsUrl: creditsUrl(), creditsBackup: !!S.creditsBackup, hasCreditsBackup: !!env.CREDITS_URL_BACKUP, ping: S.ping || null,
    present: { count: Object.keys(S.present || {}).length, last: recentPresent }, // calentamiento “¡Presente!” // round cambia con cada mazo nuevo: los celulares piden su tabla otra vez
    counts: { users: users.length, credits: users.filter((u) => u.credits).length, cards: cards.length, queue: queue.length + busy },
    recent: cards.sort((a, b) => b.at - a.at).slice(0, 24).map(meta),
    deck: S.deck.map((id) => meta(S.cards[id])).filter(Boolean),
    sung: S.sung, winners: S.winners,
    minutes: S.gameStart ? Math.round(((S.gameEnd || Date.now()) - S.gameStart) / 60000) : 0,
  };
};
let broadcastTimer;
const broadcast = () => {
  persist();
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => { // máx. ~3 envíos por segundo, sin importar cuántos cambios haya
    broadcastTimer = null;
    const msg = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const res of clients) res.write(msg);
  }, 300);
};
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20000);

// ---------- sesión ----------
const sign = (uid) => `${uid}.${crypto.createHmac('sha256', SECRET).update(uid).digest('base64url')}`;
const userOf = (req) => {
  const sid = /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  const uid = sid && decodeURIComponent(sid).split('.')[0];
  return uid && sign(uid) === decodeURIComponent(sid) ? S.users[uid] : null;
};
const login = (req, res, u) => {
  S.users[u.uid] ??= { ...u, credits: false, cardId: null, attempts: 0, failures: 0, status: null, board: null };
  // Secure solo sobre https: en local por IP (http://192.168…) el navegador descartaría la cookie y todo daría 401
  const https = req.secure || req.get('x-forwarded-proto') === 'https';
  res.setHeader('Set-Cookie', `sid=${encodeURIComponent(sign(u.uid))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${https ? '; Secure' : ''}`);
  broadcast();
  res.json({ ok: true });
};
// Host: en local (sin K_SERVICE) cualquiera, para ensayar. En Cloud Run: la cuenta de Google de HOST_EMAILS
// o la llave HOST_KEY (/host?key=…), lo que haya.
const isHost = (u, req) => !env.K_SERVICE
  || (!!CLIENT_ID && !!u && HOSTS.includes(u.email))
  || (!!env.HOST_KEY && req.get('x-host-key') === env.HOST_KEY);
const oauth = new OAuth2Client(CLIENT_ID);

// ---------- cola de cartas (protege la cuota de imágenes) ----------
const queue = [], selfies = new Map();
let busy = 0;
// Gemini saturado (cuota por minuto o capacidad compartida): no es culpa de la foto, la carta vuelve a la fila.
const isBusyError = (e) => /429|RESOURCE_EXHAUSTED|quota|rate limit|503|UNAVAILABLE|overloaded/i.test(String(e?.message ?? e));
const MAX_RETRIES = 6; // ~6 reintentos con espera creciente (≈ 2 min en total) antes de darla por fallida
const pump = () => {
  while (busy < WORKERS && queue.length) {
    const uid = queue.shift(), u = S.users[uid], job = selfies.get(uid);
    busy++; u.status = 'baking'; broadcast();
    make(u, job)
      .then(() => selfies.delete(uid))
      .catch((e) => {
        console.error(uid, e.message);
        job.retries = (job.retries || 0) + 1;
        if (isBusyError(e) && job.retries <= MAX_RETRIES) { // reintento sin gastar intentos ni contar fallo
          u.status = 'queued';
          setTimeout(() => { queue.push(uid); broadcast(); pump(); }, Math.min(30000, 2000 * 2 ** (job.retries - 1)) + Math.random() * 1000);
          return;
        }
        selfies.delete(uid);
        u.failures++; u.status = 'error';
        u.error = isBusyError(e) ? 'Gemini está muy ocupado ahora mismo. Intenta de nuevo en un minuto.' : 'No se pudo hornear tu carta. Intenta con otra foto.';
      })
      .finally(() => { busy--; broadcast(); pump(); });
  }
};
async function make(u, { selfie, archetype, name }) {
  const id = crypto.randomUUID().slice(0, 8);
  // imagen por un lado; verso + voz por el otro (la voz tarda ~8 s y así no alarga la fila). La selfie nunca se guarda.
  const [{ art, thumb, place }, { v, wav }] = await Promise.all([
    cardArt(selfie, archetype),
    verse(name, archetype).then(async (v) => ({ v, wav: await tts(`¡${v.verse.replace(/[.!¡]+$/, '')}! … ¡${v.title}!`).catch((e) => (console.error('tts', id, e.message), null)) })),
  ]);
  await Promise.all([save(`cards/${id}.webp`, art), save(`cards/${id}-t.webp`, thumb), wav && save(`voices/${id}.wav`, wav)]);
  if (u.cardId) delete S.cards[u.cardId]; // el reintento reemplaza la carta anterior
  S.cards[id] = { id, uid: u.uid, n: ++S.n, name, archetype, place, title: v.title, verse: v.verse, audio: !!wav, at: Date.now() };
  Object.assign(u, { cardId: id, attempts: u.attempts + 1, status: 'ready', error: null });
}

// ---------- API ----------
const app = express();
app.use(express.json({ limit: '3mb' }), (req, res, next) => { req.body ??= {}; next(); });
// La portada lleva la URL absoluta en og:image (WhatsApp y compañía no aceptan rutas relativas); el resto es estático.
const appUrl = (req) => env.APP_URL || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;
// se lee en cada visita (es chico): así un cambio en index.html se ve sin reiniciar el servidor
app.get('/', async (req, res) => res.type('html').send((await readFile('public/index.html', 'utf8')).replaceAll('__URL__', appUrl(req))));
app.use(express.static('public', { extensions: ['html'] }));

const auth = (req, res, next) => (req.user = userOf(req)) ? next() : res.status(401).json({ error: 'Inicia sesión' });
const host = (req, res, next) => isHost(req.user = userOf(req), req) ? next() : res.status(403).json({ error: 'Solo el host' });
const fail = (res, error, code = 400) => res.status(code).json({ error });

app.get('/api/config', (req, res) => res.json({ clientId: CLIENT_ID, guest: GUEST, archetypes: ARCHETYPES, mock: MOCK,
  creditsUrl: creditsUrl(), repoUrl: env.REPO_URL || '', appUrl: appUrl(req) }));

app.get('/api/stream', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(`retry: 3000\ndata: ${JSON.stringify(snapshot())}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.post('/api/login', async (req, res) => {
  try {
    const p = (await oauth.verifyIdToken({ idToken: req.body.credential, audience: CLIENT_ID })).getPayload();
    login(req, res, { uid: p.sub, name: p.given_name || p.name, email: (p.email || '').toLowerCase(), pic: p.picture });
  } catch { fail(res, 'Login inválido', 401); }
});
app.post('/api/guest', (req, res) => {
  if (!GUEST) return fail(res, 'Usa tu cuenta de Google', 403);
  login(req, res, { uid: 'g' + crypto.randomUUID().slice(0, 8), name: String(req.body.name || 'Invitado').slice(0, 24), email: '' });
});

app.get('/api/me', auth, (req, res) => {
  const u = req.user;
  if (!u.board && S.deck.length && ['deck', 'game', 'results'].includes(S.phase)) { u.board = deal(S.deck); persist(); }
  res.json({ ...u, host: isHost(u, req), position: u.status === 'queued' ? queue.indexOf(u.uid) + 1 : 0,
    card: meta(S.cards[u.cardId]), board: u.board?.map((id) => meta(S.cards[id]) || { id }) });
});

// Calentamiento del paso 1: cada toque sale en el proyector; cuenta una vez por persona, máximo un toque cada 2 s
app.post('/api/present', auth, (req, res) => {
  const u = req.user, now = Date.now();
  if (now - (u.presentAt || 0) < 2000) return res.json({ ok: true });
  u.presentAt = now; S.present ??= {}; S.present[u.uid] = true;
  recentPresent = [...recentPresent, { name: u.name, at: now }].slice(-12);
  broadcast(); res.json({ ok: true });
});
app.post('/api/credits', auth, (req, res) => { req.user.credits = true; broadcast(); res.json({ ok: true }); });

app.post('/api/card', auth, (req, res) => {
  const u = req.user, { selfie, archetype, name } = req.body;
  if (S.phase !== 'cards') return fail(res, 'La fábrica de cartas está cerrada');
  if (!u.credits) return fail(res, 'Primero canjea tus créditos 😉');
  if (u.status === 'queued' || u.status === 'baking') return fail(res, 'Tu carta ya está en el horno 🔥');
  if (u.attempts >= 2 || u.failures >= 3) return fail(res, 'Ya usaste tus intentos');
  if (Object.keys(S.cards).length + queue.length + busy >= MAX_CARDS) return fail(res, 'Se acabaron las cartas por hoy 🙈'); // tope de gasto
  if (typeof selfie !== 'string' || selfie.length > 2.5e6 || !ARCHETYPES.includes(archetype)) return fail(res, 'Datos inválidos');
  selfies.set(u.uid, { selfie, archetype, name: String(name || u.name).trim().slice(0, 24) });
  u.status = 'queued'; queue.push(u.uid); broadcast(); pump();
  res.json({ ok: true });
});

// “¡Lotería!”: el servidor valida la tabla contra lo cantado (las marcas del celular no cuentan).
// Antitrampa: gritar sin tener línea castiga con espera creciente (10 s, 20 s, 30 s…), así no sirve picar el botón en cada carta.
// Justicia: todos los que completan con la MISMA carta cantada empatan en el lugar (como en la lotería de verdad), sin importar quién tocó primero.
const placeOf = (w) => new Set(S.winners.filter((x) => x.mode === w.mode && x.n < w.n).map((x) => x.n)).size + 1;
app.post('/api/claim', auth, (req, res) => {
  const u = req.user, now = Date.now();
  if (S.phase !== 'game' || !S.deck.length) return fail(res, 'No hay juego en curso');
  u.board ??= deal(S.deck); // si su celular aún no pidió tabla en esta ronda, se le reparte aquí mismo
  const mine = S.winners.find((w) => w.uid === u.uid && w.mode === S.mode);
  if (mine) return res.json({ ok: true, place: placeOf(mine) });
  if (u.blockedUntil > now) return fail(res, `⏳ Espera ${Math.ceil((u.blockedUntil - now) / 1000)} s: gritaste sin tener lotería`, 429);
  if (!wins(u.board, S.sung, S.mode)) {
    u.falseClaims = (u.falseClaims || 0) + 1;
    u.blockedUntil = now + Math.min(60, 10 * u.falseClaims) * 1000;
    return fail(res, `Aún no… revisa tu tabla 👀 (espera ${Math.min(60, 10 * u.falseClaims)} s para volver a gritar)`);
  }
  const w = { uid: u.uid, name: u.name, cardId: u.cardId, mode: S.mode, n: S.sung.length, at: now };
  S.winners.push(w); broadcast();
  res.json({ ok: true, place: placeOf(w) });
});

const cache = { 'Cache-Control': 'public, max-age=31536000, immutable' };
app.get('/img/:id', async (req, res) => {
  const id = req.params.id.replace(/[^\w-]/g, '');
  const buf = await load(`cards/${id}.webp`);
  buf ? res.set({ ...cache, 'Content-Type': 'image/webp' }).send(buf) : res.sendStatus(404);
});
app.get('/audio/:id', async (req, res) => {
  const buf = await load(`voices/${req.params.id.replace(/\W/g, '')}.wav`);
  buf ? res.set({ ...cache, 'Content-Type': 'audio/wav' }).send(buf) : res.sendStatus(404);
});
app.get('/api/qr', async (req, res) => {
  const u = String(req.query.u || '');
  if (!/^https?:\/\//.test(u) || u.length > 300) return res.sendStatus(400);
  res.type('svg').send(await QRCode.toString(u, { type: 'svg', margin: 1, color: { dark: '#1E1E1E', light: '#FFFFFF' } }));
});

// ---------- host ----------
app.get('/api/host/cards', host, (req, res) => res.json(Object.values(S.cards).sort((a, b) => b.at - a.at)));
// Quién entró y en qué va (para ver desde el host a quién se le atoró la carta)
app.get('/api/host/users', host, (req, res) => res.json(Object.values(S.users).map((u) => ({ uid: u.uid, name: u.name, email: u.email, credits: u.credits, status: u.status, attempts: u.attempts, failures: u.failures, error: u.error, hasCard: !!u.cardId }))));
app.post('/api/host/phase', host, (req, res) => {
  if (!PHASES.includes(req.body.phase)) return fail(res, 'Fase inválida');
  S.phase = req.body.phase;
  if (S.phase === 'results' && S.gameStart) S.gameEnd ??= Date.now();
  // al entrar a “Mazo y tablas” el mazo se arma solo si aún no hay (si faltan cartas, el host lo avisa)
  if (S.phase === 'deck' && !S.deck.length) { try { buildGame(); } catch (e) { console.warn('deck:', e.message); } }
  broadcast(); res.json({ ok: true });
  if (S.phase === 'game') voices(); // por si alguna voz quedó pendiente (o falló) al armar el mazo
});
function buildGame() { // mazo nuevo + tablas nuevas + voces en segundo plano
  S.deck = buildDeck(Object.values(S.cards).filter((c) => !c.hidden).map((c) => c.id));
  S.sung = []; S.winners = []; S.mode = 'line'; S.gameStart = 0; S.gameEnd = null; S.round = (S.round || 0) + 1;
  for (const u of Object.values(S.users)) { u.board = null; u.falseClaims = 0; u.blockedUntil = 0; } // tablas nuevas al abrir la app; castigos en cero
  broadcast();
  voices();
}
app.post('/api/host/deck', host, (req, res) => {
  try { buildGame(); res.json({ ok: true, size: S.deck.length }); } catch (e) { fail(res, e.message); }
});
let voicesBusy = false; // mientras es true no se puede cantar: que no salga una carta sin su voz
async function voices() {
  if (voicesBusy) return;
  voicesBusy = true; broadcast();
  try { await generateVoices(); } finally { voicesBusy = false; broadcast(); }
}
async function generateVoices() {
  // la verdad está en el archivo, no en la bandera: si alguien borró voces (o cambió el texto), se regeneran
  const pending = [];
  for (const c of S.deck.map((id) => S.cards[id]).filter(Boolean)) {
    if (await load(`voices/${c.id}.wav`)) { c.audio = true; continue; }
    c.audio = false; pending.push(c);
  }
  broadcast();
  const run = async () => {
    for (let c; (c = pending.shift()); ) {
      // como gritón: admiraciones y una pausa antes del título
      try { const wav = await tts(`¡${c.verse.replace(/[.!¡]+$/, '')}! … ¡${c.title}!`); if (wav) { await save(`voices/${c.id}.wav`, wav); c.audio = true; broadcast(); } }
      catch (e) { console.error('tts', c.id, e.message); }
    }
  };
  await Promise.all([run(), run(), run()]);
}
// Darle otra oportunidad a alguien: borra su carta (si la tiene) y sus intentos; vuelve a empezar desde cero.
app.post('/api/host/user/reset', host, (req, res) => {
  const u = S.users[req.body.uid];
  if (!u) return fail(res, 'Jugador no encontrado', 404);
  if (u.cardId) { delete S.cards[u.cardId]; S.deck = S.deck.filter((id) => id !== u.cardId); S.sung = S.sung.filter((id) => id !== u.cardId); }
  Object.assign(u, { cardId: null, attempts: 0, failures: 0, status: null, error: null });
  broadcast(); res.json({ ok: true });
});
app.post('/api/host/call', host, (req, res) => { // canta la siguiente carta
  if (S.phase !== 'game') return fail(res, 'Pasa a la fase de juego');
  if (!S.deck.length) return fail(res, 'El mazo está vacío: ármalo en el paso 5 (necesita al menos 16 cartas; para ensayar, siembra cartas falsas)');
  if (voicesBusy) return fail(res, `Espera: las voces se están generando (${S.deck.filter((id) => S.cards[id]?.audio).length}/${S.deck.length})`);
  const id = nextCard(S.deck, S.sung);
  if (!id) return fail(res, 'Ya se cantaron todas');
  S.gameStart ||= Date.now();
  S.sung.push(id); broadcast(); res.json({ ok: true, id });
});
// Demo de SSE: un mensaje que viaja del servidor a todos los celulares y al proyector a la vez
app.post('/api/host/ping', host, (req, res) => { S.ping = { n: (S.ping?.n || 0) + 1, at: Date.now() }; broadcast(); res.json({ ok: true, n: S.ping.n }); });
app.post('/api/host/mode', host, (req, res) => {
  S.mode = req.body.mode === 'full' ? 'full' : 'line';
  for (const u of Object.values(S.users)) { u.falseClaims = 0; u.blockedUntil = 0; } // nueva meta, castigos en cero
  broadcast(); res.json({ ok: true });
});
// Tutorial del canje en el proyector: el host avanza o regresa un paso (0 a 7)
app.post('/api/host/guide', host, (req, res) => { S.guideStep = Math.max(0, Math.min(7, (S.guideStep || 0) + (req.body.delta === -1 ? -1 : 1))); broadcast(); res.json({ ok: true, step: S.guideStep }); });
app.post('/api/host/credits-backup', host, (req, res) => { S.creditsBackup = !S.creditsBackup; broadcast(); res.json({ ok: true, backup: S.creditsBackup }); });
app.post('/api/host/hide', host, (req, res) => {
  const c = S.cards[req.body.id];
  if (c) { c.hidden = !c.hidden; S.deck = S.deck.filter((id) => !S.cards[id].hidden); broadcast(); }
  res.json({ ok: true });
});
// Ensayo: jugadores y cartas falsas (sin Gemini, no gasta). Útil para probar solo antes del evento; luego “Borrar todo”.
const FAKE_VERSES = ['El que compila a la primera', 'Con café y sin dormir, el deploy va a salir', 'Desde la muralla programa sin falla', 'Commit tras commit, nadie la hace como él'];
app.post('/api/host/seed', host, async (req, res) => {
  const names = ['Ana', 'Luis', 'Sofía', 'Diego', 'Vale', 'Marco', 'Fer', 'Iván', 'Paty', 'Raúl', 'Karla', 'Beto'];
  for (let i = 0; i < (+req.body.n || 54); i++) {
    const uid = 'f' + crypto.randomUUID().slice(0, 8), id = uid.slice(1), archetype = ARCHETYPES[i % ARCHETYPES.length], name = names[i % names.length];
    const { art, thumb } = await fakeArt(S.n);
    await Promise.all([save(`cards/${id}.webp`, art), save(`cards/${id}-t.webp`, thumb)]);
    S.users[uid] = { uid, name, email: '', credits: true, cardId: id, attempts: 1, failures: 0, status: 'ready', board: null };
    S.cards[id] = { id, uid, n: ++S.n, name, archetype, title: archetype, verse: FAKE_VERSES[i % FAKE_VERSES.length], fake: true, at: Date.now() };
  }
  broadcast(); res.json({ ok: true });
});
app.post('/api/host/reset', host, async (req, res) => {
  // “Borrar todo” también borra los archivos: imágenes de las cartas y voces (son derivadas de selfies; no deben quedarse)
  if (req.body.all) { queue.length = 0; selfies.clear(); await Promise.all([removeAll('cards/'), removeAll('voices/')]).catch((e) => console.error('removeAll', e.message)); }
  S = { ...S, phase: 'welcome', mode: 'line', deck: [], sung: [], winners: [], gameStart: 0, gameEnd: null, present: {},
    ...(req.body.all ? { users: {}, cards: {}, n: 0 } : {}) };
  recentPresent = [];
  for (const u of Object.values(S.users)) u.board = null;
  broadcast(); res.json({ ok: true });
});

app.listen(env.PORT || 8080, () => console.log(`Lotería lista en http://localhost:${env.PORT || 8080}  ${MOCK ? '(modo ensayo: sin Gemini)' : ''}`));
