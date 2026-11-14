// App del asistente (celular): login → créditos → selfie → carta → tabla → ¡Lotería!
import { $, esc, api, stream, cardHTML, loginUI, busy } from './common.js';

const main = $('#main');
const cfg = await api('/api/config');
let me = null, st = null, key = '', poll;

const toast = (msg, ms = 2500) => { $('#toast').textContent = msg; clearTimeout(toast.t); toast.t = setTimeout(() => ($('#toast').textContent = ''), ms); };
const refresh = async () => { try { me = await api('/api/me'); } catch { me = null; } render(); };

// WhatsApp/Instagram/Facebook abren su propio navegador y Google bloquea el login ahí.
const inApp = /Instagram|FBAN|FBAV|WhatsApp|Line\//i.test(navigator.userAgent);
// Celular o tablet (pantalla táctil): ahí ofrecemos la cámara; en escritorio solo el selector de archivos.
const mobile = matchMedia('(pointer: coarse)').matches;

// Qué vista toca según la fase del juego y el estado del asistente.
function view() {
  if (!me) return 'login';
  const p = st.phase;
  if (['deck', 'game'].includes(p)) return 'board';
  if (p === 'results') return 'results';
  if (p === 'repo') return 'repo';
  if (!me.credits) return 'credits';
  if (p === 'cards') return me.status === 'queued' || me.status === 'baking' ? 'baking' : me.cardId ? 'ready' : 'form';
  return me.cardId ? 'ready' : 'waiting';
}

function render() {
  if (!st) return;
  const v = view(), k = [v, me?.status, me?.cardId, me?.attempts, me?.board?.length, me?.position, st.phase, st.creditsUrl, v === 'results' ? st.winners.length : 0].join('|');
  // Sin cambios no se redibuja: cada aviso del servidor borraría lo que la persona escribe (nombre, selfie, casilla)
  if (key === k) return v === 'board' ? paintBoard() : undefined;
  key = k;
  clearInterval(poll);
  if (v === 'baking') poll = setInterval(refresh, 3000);
  document.body.classList.toggle('playing', v === 'board');
  keepAwake(v === 'board' || v === 'baking');
  main.innerHTML = VIEWS[v]();
  BIND[v]?.();
}

// Calentamiento: mientras la sala entra, cada toque sale en el proyector
const presentBtn = () => ['welcome', 'credits'].includes(st.phase) ? '<button class="btn big" id="present" style="margin-top:16px">🙋 ¡Presente!</button>' : '';
const bindPresent = () => { const b = $('#present'); if (b) b.onclick = (e) => busy(e.currentTarget, async () => { await api('/api/present', {}); toast('¡Mira la pantalla! 👀', 1500); navigator.vibrate?.(80); }); };

// Mientras juegas (o esperas tu carta) la pantalla no se apaga: si el celular se bloquea, se corta el tiempo real
// y te pierdes cartas. Screen Wake Lock: Chrome/Android y Safari 16.4+; si no existe, no pasa nada.
let wakeLock = null, wantAwake = false;
async function keepAwake(on) {
  wantAwake = on;
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.onrelease = () => (wakeLock = null); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wantAwake && keepAwake(true)); // el SO lo suelta al salir de la app

const VIEWS = {
  login: () => `<p class="hero">Haz tu carta de lotería con <span class="b">Gemini</span> y juega con todo el DevFest.</p>
    ${inApp ? '<div class="box"><b>⚠️ Abre esta página en Chrome o Safari.</b><p class="mute">Desde WhatsApp o Instagram, Google no deja iniciar sesión. Toca ⋯ → “Abrir en el navegador”.</p></div>' : ''}
    <div class="box"><p style="margin-bottom:14px">Entra con tu <b>cuenta personal de Google</b> (Gmail). La misma con la que canjearás tus créditos.</p><div id="login"></div>
    <p class="mute" style="font-size:13px;margin-top:14px">Al entrar aceptas el <a href="/privacy" target="_blank">aviso de privacidad</a>: tu selfie no se guarda; tu carta se borra al terminar el evento.</p></div>`,
  credits: () => `<p class="hero">Hola, ${esc(me.name)} 👋</p>
    <div class="box"><h3>Paso 1 · Canjea tus créditos de Google Cloud</h3>
      <p class="mute" style="margin:8px 0 16px">Con ellos podrás desplegar este mismo proyecto. Usa una cuenta <b>@gmail.com</b>: no sirven las de escuela o trabajo, y se canjea una sola vez por cuenta.</p>
      ${st.creditsUrl ? `<a class="btn big" id="redeem" style="display:block;text-align:center;text-decoration:none" href="${esc(st.creditsUrl)}" target="_blank">Canjear créditos ↗</a>` : '<p class="pill">Muy pronto aparece aquí el link 👀</p>'}
      <p class="mute" style="font-size:14px;margin-top:12px">Te pedirá crear tu perfil de Google Developer y un reCAPTCHA. <a href="/guia-creditos.pdf" target="_blank">Ver guía paso a paso</a></p>
      <label style="display:flex;gap:10px;align-items:center;margin-top:18px"><input type="checkbox" id="ok" style="width:24px;height:24px"> Ya los canjeé ✅</label>
      <button class="btn dark big" id="next" disabled style="margin-top:12px">Continuar</button></div>${presentBtn()}`,
  waiting: () => `<p class="hero">¡Listo, ${esc(me.name)}! ✅</p><div class="box"><p>Te esperamos en el taller <b>Lotería DevFest con Gemini</b>: ahí harás tu carta de lotería y jugaremos todos 🃏</p><p class="mute" style="margin-top:10px">Deja esta página abierta o vuelve a escanear el QR.</p></div>${presentBtn()}`,
  form: () => `<p class="hero">Paso 2 · Tu carta</p>
    <div class="box">
      <label>¿Cómo te llamamos?</label><input type="text" id="name" maxlength="24" value="${esc(me.name)}">
      <label>¿Qué carta eres?</label><select id="archetype">${cfg.archetypes.map((a) => `<option>${esc(a)}</option>`).join('')}</select>
      <label>Tu selfie</label>
      <div style="display:flex;gap:10px">${mobile
        ? '<button type="button" class="btn" id="shoot" style="flex:1">📸 Tomar selfie</button><button type="button" class="btn" id="pick" style="flex:1">🖼️ De la galería</button>'
        : '<button type="button" class="btn" id="pick" style="flex:1">🖼️ Elegir una foto</button>'}</div>
      <input type="file" id="camera" accept="image/*" capture="user" hidden><input type="file" id="gallery" accept="image/*" hidden>
      <img id="preview" class="preview" alt="" hidden><p id="photoStatus" class="mute" style="text-align:center;font-size:14px;margin-top:8px"></p>
      <p class="mute" style="font-size:13px;margin-top:8px">Tu foto solo se usa para dibujar la carta; no se guarda. La carta sí aparecerá en la pantalla.</p>
      ${me.error ? `<p class="r">${esc(me.error)}</p>` : ''}
      <button class="btn dark big" id="make" disabled style="margin-top:16px">Hacer mi carta ✨</button></div>`,
  baking: () => `<div class="box" style="text-align:center"><div class="baking">🔥</div><h3>Tu carta está en el horno</h3>
    <p class="mute">${me.position ? `Vas en el lugar ${me.position} de la fila` : 'Gemini la está dibujando…'}</p></div>`,
  ready: () => `<p class="hero">¡Esta eres tú! 🎉</p><div class="my-card">${cardHTML(me.card, '')}</div>
    <p class="verse">“${esc(me.card.verse)}”</p>
    ${st.phase === 'cards' && me.attempts < 2 ? '<button class="btn big" id="retry">Hacer otra (te queda 1 intento)</button>' : ''}
    <p class="mute" style="text-align:center">Búscala en la pantalla 👀 Pronto repartimos las tablas.</p>`,
  board: () => `<div class="called" id="called"></div>
    <div class="board" id="board">${(me.board || []).map((c) => cardHTML(c)).join('')}</div>
    <p class="mute" style="text-align:center;font-size:13px">Toca para poner frijolito · Gana: <b id="mode"></b></p>
    <button class="btn dark big" id="claim" style="font-size:28px">¡LOTERÍA!</button>`,
  results: () => {
    const w = st.winners.find((x) => x.uid === me.uid);
    return `<p class="hero">${w ? '¡Ganaste! 🏆' : '¡Gracias por jugar!'}</p>
      ${w ? `<div class="box"><b>Hiciste ${w.mode === 'full' ? 'tabla llena' : 'línea'}</b> con ${w.n} cartas cantadas.</div>` : ''}
      ${me.card ? `<div class="my-card">${cardHTML(me.card, '')}</div>` : ''}`;
  },
  repo: () => `<p class="hero">Ahora hazlo tú 🚀</p>
    <div class="box"><p>Clona el repo y despliégalo en tu proyecto con tus créditos. Todo viene paso a paso.</p>
    ${cfg.repoUrl ? `<a class="btn dark big" style="display:block;text-align:center;text-decoration:none;margin-top:16px" href="${esc(cfg.repoUrl)}" target="_blank">Abrir el repo ↗</a>` : ''}</div>
    ${me.card ? `<div class="my-card">${cardHTML(me.card, '')}</div>` : ''}`,
};

const BIND = {
  login: () => loginUI($('#login'), cfg, refresh),
  credits: () => { $('#ok').onchange = (e) => ($('#next').disabled = !e.target.checked); $('#next').onclick = (e) => busy(e.currentTarget, () => api('/api/credits', {}).then(refresh)); bindPresent(); },
  waiting: bindPresent,
  form: () => {
    selfie = null;
    if ($('#shoot')) $('#shoot').onclick = () => $('#camera').click(); // abre la cámara frontal directo
    $('#pick').onclick = () => $('#gallery').click();
    for (const id of ['#camera', '#gallery']) $(id).onchange = (e) => e.target.files[0] && loadSelfie(e.target.files[0]);
    $('#make').onclick = (e) => busy(e.currentTarget, makeCard);
  },
  ready: () => { const b = $('#retry'); if (b) b.onclick = () => { me.cardId = null; render(); }; },
  board: () => {
    $('#board').onclick = (e) => {
      const c = e.target.closest('.card'); if (!c) return;
      const m = marks(); m[c.dataset.id] = !m[c.dataset.id]; localStorage.setItem(marksKey(), JSON.stringify(m)); paintBoard();
    };
    $('#claim').onclick = (e) => busy(e.currentTarget, async () => {
      try { const r = await api('/api/claim', {}); toast(`🏆 ¡Lotería! Quedaste en el lugar ${r.place}`, 6000); navigator.vibrate?.([100, 50, 300]); }
      catch (e) { toast(e.message); refresh(); } // tras un rechazo, resincroniza la tabla con el servidor por si quedó vieja
    });
    paintBoard();
  },
};

// ---------- selfie ----------
// La foto se lee y se reduce en cuanto la eligen (768 px, JPEG), así “Hacer mi carta” es instantáneo.
// En iOS con iCloud la foto puede tardar en bajar: el archivo llega, pero leerlo falla unos segundos. Reintentamos con pausa.
let selfie = null; // base64 JPEG listo para enviar
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function decode(file) {
  try { return await createImageBitmap(file); } // rápido y soporta la mayoría de formatos
  catch { // respaldo: <img> (Safari viejo, HEIC convertido, etc.)
    const url = URL.createObjectURL(file);
    try { return await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; }); }
    finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
  }
}
async function loadSelfie(file) {
  const status = $('#photoStatus'), make = $('#make'), preview = $('#preview');
  selfie = null; make.disabled = true; preview.hidden = true; status.textContent = '⏳ Cargando tu foto…';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const img = await decode(file), w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
      const s = Math.min(1, 768 / Math.max(w, h));
      const cv = Object.assign(document.createElement('canvas'), { width: Math.round(w * s), height: Math.round(h * s) });
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      img.close?.();
      const dataUrl = cv.toDataURL('image/jpeg', 0.85);
      selfie = dataUrl.split(',')[1];
      preview.src = dataUrl; preview.hidden = false; status.textContent = '✅ Lista'; make.disabled = false;
      return;
    } catch {
      status.textContent = `⏳ Esperando la foto… (${attempt}/4)`; // iCloud todavía la está bajando
      await wait(1500 * attempt);
    }
  }
  status.textContent = '';
  toast('No pude leer esa foto. Espera a que termine de descargarse o prueba con otra 📸', 5000);
}

async function makeCard() {
  if (!selfie) return toast('Toma o elige una selfie 📸');
  $('#make').disabled = true;
  try {
    await api('/api/card', { selfie, archetype: $('#archetype').value, name: $('#name').value });
    await refresh();
  } catch (e) { toast(e.message); $('#make').disabled = false; }
}

// ---------- tabla ----------
// Los frijolitos viven en el celular (localStorage), una lista por tabla.
const marksKey = () => 'marks-' + (me.board || []).map((c) => c.id).join('');
const marks = () => { try { return JSON.parse(localStorage.getItem(marksKey())) || {}; } catch { return {}; } };
let notified = false;
function paintBoard() {
  if (!me.board) return;
  const m = marks();
  document.querySelectorAll('#board .card').forEach((el) => {
    el.classList.toggle('on', !!m[el.dataset.id]);
    el.classList.toggle('mine', el.dataset.id === me.cardId);
  });
  $('#mode').textContent = st.mode === 'full' ? 'tabla llena' : 'línea de 4 (fila, columna o diagonal)';
  $('#claim').disabled = st.phase !== 'game';
  const last = st.deck.find((c) => c.id === st.sung.at(-1));
  // las 3 anteriores, por si se te pasó una
  const before = st.sung.slice(-4, -1).reverse().map((id) => st.deck.find((c) => c.id === id)?.title).filter(Boolean);
  $('#called').innerHTML = last ? `${cardHTML(last)}<div><p class="mute" style="font-size:13px">Cantaron (${st.sung.length}):</p><h3>${esc(last.title)}</h3>${before.length ? `<p class="recent">Antes: ${before.map(esc).join(' · ')}</p>` : ''}</div>`
    : `<p class="mute">${st.phase === 'deck' ? 'Esta es tu tabla. ¡Ya casi empezamos!' : 'Esperando la primera carta…'}</p>`;
  if (me.cardId && st.sung.includes(me.cardId) && !notified) { notified = true; toast('🎉 ¡Cantaron TU carta! Mira la pantalla', 6000); navigator.vibrate?.(400); }
}

let phase;
stream((s) => {
  if (s.ping && s.ping.n !== st?.ping?.n && st) { toast(`📡 Mensaje #${s.ping.n} del servidor, por SSE`, 3000); navigator.vibrate?.(200); } // demo del paso SSE
  // volver a pedir /api/me si cambió la fase, el mazo (nueva ronda) o ya salió mi carta del horno
  const changed = s.phase !== phase || s.round !== st?.round || s.deck.length !== st?.deck.length || (me?.status === 'baking' && s.counts.queue === 0);
  st = s; phase = s.phase;
  changed ? refresh() : render();
});
