// Utilidades compartidas por las 3 vistas.
export const $ = (s, el = document) => el.querySelector(s);
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const hostKey = () => { try { return localStorage.getItem('hostKey') || ''; } catch { return ''; } };
export async function api(path, body) {
  const headers = { 'Content-Type': 'application/json', 'x-host-key': hostKey() };
  const r = await fetch(path, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { status: r.status });
  return j;
}

// Tiempo real por SSE. iOS corta la conexión al bloquear el celular o cambiar de app y a veces no la reabre sola:
// al volver a la pestaña, si quedó cerrada, la reabrimos (el primer mensaje trae el estado completo).
export const stream = (cb) => {
  let es;
  const open = () => {
    es = new EventSource('/api/stream');
    es.onmessage = (e) => { try { cb(JSON.parse(e.data)); } catch (err) { console.error('stream', err); } }; // un error en una vista no debe matar el tiempo real
  };
  open();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && es.readyState === EventSource.CLOSED) open(); });
};

// Corre una acción bloqueando el botón que la disparó (clase busy: puntos animados) hasta que el servidor responda:
// evita dobles toques y deja claro que está trabajando.
export async function busy(btn, fn) {
  if (btn?.classList.contains('busy')) return;
  btn?.classList.add('busy'); if (btn) btn.disabled = true;
  try { return await fn(); } finally { btn?.classList.remove('busy'); if (btn) btn.disabled = false; }
}

export const qr = (url) => `/api/qr?u=${encodeURIComponent(url)}`;

// Una carta de lotería con marco DF26. size: '-t' miniatura (tablas), '' arte completo (proyector).
export const cardHTML = (c, size = '-t') => c ? `<div class="card" data-id="${c.id}">
  <span class="num">${c.n}</span><img src="/img/${c.id}${size}" alt="" loading="lazy"><b class="title">${esc(c.title)}</b></div>` : '';

// Login: botón de Google si hay GOOGLE_CLIENT_ID; además (o en su lugar) entrar por nombre cuando el servidor lo permite
// (local con `make run`, o ALLOW_GUEST=1 en la nube para pruebas de carga).
export function loginUI(el, cfg, done) {
  el.innerHTML = '';
  if (cfg.clientId) {
    el.insertAdjacentHTML('beforeend', '<div id="gbtn"></div>');
    const s = Object.assign(document.createElement('script'), { src: 'https://accounts.google.com/gsi/client', async: true });
    s.onload = () => {
      google.accounts.id.initialize({ client_id: cfg.clientId, callback: (r) => api('/api/login', { credential: r.credential }).then(done, (e) => alertBox(el, e.message)) });
      google.accounts.id.renderButton($('#gbtn'), { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es' });
    };
    document.head.append(s);
  }
  if (cfg.guest) {
    el.insertAdjacentHTML('beforeend', `${cfg.clientId ? '<p class="mute" style="margin:14px 0 8px;text-align:center">o, para ensayar, entra con tu nombre</p>' : ''}
      <input id="gname" class="btn" placeholder="Tu nombre" maxlength="24" style="width:100%;margin-bottom:12px">
      <button class="btn dark big" id="ggo">Entrar como invitado</button>`);
    $('#ggo').onclick = () => api('/api/guest', { name: $('#gname').value || 'Invitado' }).then(done);
  }
}
const alertBox = (el, msg) => el.insertAdjacentHTML('beforeend', `<p class="r">${esc(msg)}</p>`);
