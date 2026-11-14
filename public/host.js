// Consola del host: avanzar fases (como diapositivas), cantar, moderar. Incluye el guion de cada paso.
// Lo cotidiano a la vista (siguiente paso, cantar); lo raro, bajo “Más…”.
import { $, esc, api, stream, cardHTML, loginUI, busy } from './common.js';

// [fase, título, guion]
const STEPS = [
  ['welcome', 'Bienvenida + QR', `Muestra el QR. “Abran la cámara del celular, NO desde WhatsApp.”
Que entren con su Gmail personal (no el de la escuela/trabajo).
Mientras entran: “Toquen ¡Presente! en su celular” → estallan en el proyector y sube el contador. Rompe el hielo y prueba el tiempo real con toda la sala.
“Hoy van a ser carta de lotería… hecha por Gemini.”`],
  ['credits', 'Créditos: ¿quién falta?', `En la keynote ya canjearon con el QR directo a Google; aquí entran a la app y marcan “Ya los canjeé ✅” (mira el contador).
“¿Quién no ha canjeado? Este es el QR.” Mismo Gmail personal → aceptar → “Ya los canjeé ✅”.
Si atoran: pide perfil de Google Developer y reCAPTCHA (la guía está en la app). La cuenta de facturación tarda hasta 5 min en aparecer.
1–2 min y seguimos; quien falte lo hace mientras juega.`],
  ['creditsGuide', 'Canje paso a paso', `Hazlo con quienes faltan: cada toque de “Paso siguiente” cambia el paso y la captura en el proyector.
El QR sigue en pantalla. Solo @gmail.com, un canje por cuenta.
Quien se atore, lo termina mientras seguimos. 3–4 min.`],
  ['deploy', 'Así se despliega', `No expliques código: explica cómo se configura y se despliega, que es lo que van a replicar.
1) Proyecto con créditos. 2) Google Auth Platform: marca + cliente OAuth (el login). 3) .env con PROJECT, HOST_KEY y GOOGLE_CLIENT_ID. 4) setup.sh: APIs, bucket, cuenta de servicio con permiso a Gemini. 5) deploy.sh: Cloud Run te da la URL.
Abre el repo y muestra .env.example y los dos scripts (son cortos). Remata con el diagrama de la derecha: celulares ⇄ Cloud Run (SSE) → Gemini (Vertex, sin claves) · Storage de respaldo · Sign-In. 3–4 min.`],
  ['sse', 'Tiempo real: SSE', `Pregunta: “¿cómo le llega a 400 celulares la carta cantada al mismo tiempo?” → SSE.
Es un estándar web (WHATWG, propuesto en 2004 por Ian Hickson; Opera lo estrenó en 2006), no es de Google. HTTP normal, una conexión abierta, el servidor escribe líneas “data:”; el navegador lo trae nativo (EventSource) y se reconecta solo.
Quién lo usa: así te llega palabra por palabra la respuesta de ChatGPT, de la API de Gemini (alt=sse) y de la de Claude. Luego la tabla vs WebSockets.
Código (lo único que vale ver, 10 líneas): common.js → stream() y server.js → /api/stream. 3 min.`],
  ['sseDemo', 'SSE en vivo', `A la izquierda, TODO el código del tiempo real (10 líneas). A la derecha, la simulación con la sala real.
Pulsa “📡 Enviar mensaje a todos”: el proyector dibuja el mensaje viajando del servidor a cada celular y todos los teléfonos vibran a la vez con un aviso. Hazlo 2–3 veces: “así llegará cada carta cantada”.
“¿Cuántos están conectados ahora?” → el contador. 2 min.`],
  ['cards', 'Fábrica de cartas', `Abre la fábrica: selfie + nombre + “¿qué carta eres?”.
Cada quien tiene 1 carta + 1 reintento. Si hay fila, la app les dice su lugar.
Lee en voz alta algunos versos del muro. Modera aquí abajo (clic = ocultar). 6–8 min.`],
  ['deck', 'Mazo y tablas', `Al entrar aquí el mazo se arma solo con TODAS las cartas de la sala, barajadas.
Cada celular recibe su tabla de 4×4. “Si tu carta quedó en el mazo… ¡prepárate!”
Cada carta ya trae su voz desde que se hizo; si falta alguna, se genera aquí (mira el contador de voces).`],
  ['game', '¡A cantar!', `Cantar ▶ (o la barra espaciadora), o Auto cada 8 s.
Tras la primera carta cantada, 1 min de contexto: “La voz es Gemini TTS, lo que vieron en la charla de Eduardo. Es UNA llamada.” Abre gemini.js → tts(): ~10 líneas. El truco: la dirección de estilo va entre corchetes (el modelo la obedece sin leerla) y la voz se elige por nombre (Puck). Único código que vale la pena enseñar.
Primera ronda: línea de 4. Cuando haya ganador, celebra 🎉 y cambia a “tabla llena” si hay tiempo. El servidor valida cada “¡Lotería!”: nadie puede hacer trampa.`],
  ['results', 'Ganadores y resumen', `Podio + resumen: jugadores, créditos canjeados, cartas hechas y cantadas.
Entrega premios. Foto grupal con la pantalla 📸`],
  ['repo', 'Ahora hazlo tú', `QR del repo y de créditos. “Clonen, sigan TALLER.md y en 15 min la tienen corriendo.”
Recuérdales: borra el proyecto o pon alerta de presupuesto al terminar.`],
];

const key = new URLSearchParams(location.search).get('key'); // /host?key=HOST_KEY (modo sin Google en la nube)
if (key) { try { localStorage.setItem('hostKey', key); } catch {} history.replaceState(null, '', '/host'); }
const cfg = await api('/api/config');
let st, me, autoTimer;

try { me = await api('/api/me'); } catch {}
if (!me?.host && (cfg.clientId || me)) {
  $('#main').innerHTML = `<div class="box" style="max-width:420px"><p style="margin-bottom:12px">${me ? 'Esta cuenta no es host (revisa HOST_EMAILS o abre /host?key=TU_HOST_KEY).' : 'Entra con la cuenta del host.'}</p><div id="login"></div></div>`;
  if (!me) loginUI($('#login'), cfg, () => location.reload());
} else {
  stream((s) => { const prev = st?.phase; st = s; render(prev !== s.phase); });
}

const setPhase = (phase) => api('/api/host/phase', { phase });
const guard = (fn) => async (...args) => { // pasa el evento (moderación lo usa) y bloquea el botón mientras responde
  const btn = args[0]?.currentTarget?.matches?.('button') ? args[0].currentTarget : null;
  try { await busy(btn, () => fn(...args)); } catch (e) { notify(e.message); }
};
const notify = (m) => { $('#msg').textContent = m; setTimeout(() => ($('#msg').textContent = ''), 4000); };
const callCard = () => api('/api/host/call', {});
const MODE = { line: 'línea', full: 'tabla llena' };

function render(full) {
  const i = STEPS.findIndex((s) => s[0] === st.phase);
  $('#steps').innerHTML = STEPS.map((s, j) => `<button class="btn ${j === i ? 'on' : ''}" data-phase="${s[0]}"><small>${j + 1}</small>${s[1]}</button>`).join('');
  document.querySelectorAll('#steps button').forEach((b) => (b.onclick = guard(() => setPhase(b.dataset.phase))));
  if (!full && $('#counts')) return update();
  $('#main').innerHTML = `
    <div class="box"><p class="mute">Paso ${i + 1} · ${st.mock ? '<span class="r">MODO ENSAYO (sin Gemini)</span>' : '<span class="g">Gemini en vivo</span>'}</p>
      <h1 style="margin:6px 0 12px">${STEPS[i][1]}</h1><p class="note">${esc(STEPS[i][2])}</p></div>
    <p id="counts" class="t3" style="margin:16px 0"></p>
    <div id="status"></div>
    ${st.phase === 'game' ? '<div id="now" class="box" style="display:flex;gap:14px;align-items:center;margin:0 0 12px"></div>' : ''}
    <div class="actions">
      ${st.phase === 'creditsGuide' ? '<button class="btn" id="guidePrev">◀ Paso anterior</button><button class="btn dark big" id="guideNext" style="flex:2 1 55%">Paso siguiente ▶</button>' : ''}
      ${st.phase === 'sseDemo' ? '<button class="btn dark big" id="ping">📡 Enviar mensaje a todos</button>' : ''}
      ${st.phase === 'game' ? '<button class="btn dark big" id="call" style="flex:2 1 60%">Cantar ▶</button><button class="btn" id="auto">Auto 8 s</button><button class="btn" id="mode"></button>' : ''}
    </div><p id="msg" class="r"></p>
    <div class="nav">${i > 0 ? `<button class="btn" id="prev">◀ ${STEPS[i - 1][1]}</button>` : ''}${i < STEPS.length - 1 ? `<button class="btn dark" id="next">${STEPS[i + 1][1]} ▶</button>` : ''}</div>
    <ol id="winners"></ol>
    ${st.phase === 'cards' ? '<h3>Moderación <span class="mute">(clic para ocultar/mostrar)</span></h3><p id="pending" class="mute" style="font-size:15px;margin:6px 0"></p><div id="cards"></div>' : ''}
    <details class="more"><summary class="mute">Más…</summary><div class="actions">
      ${['deck', 'game'].includes(st.phase) ? '<button class="btn" id="deck">Rearmar mazo</button>' : ''}
      ${st.hasCreditsBackup ? `<button class="btn" id="backup">${st.creditsBackup ? 'Créditos: usando respaldo (volver al principal)' : 'Créditos: cambiar al link de respaldo'}</button>` : ''}
      <button class="btn" id="seed">Ensayo: +54 cartas falsas</button>
      <button class="btn" id="reset">Reiniciar juego</button><button class="btn" id="wipe">Borrar todo</button>
    </div></details>`;
  const on = (id, fn) => $(id) && ($(id).onclick = guard(fn));
  on('#prev', () => setPhase(STEPS[i - 1][0]));
  on('#next', () => setPhase(STEPS[i + 1][0]));
  on('#deck', async () => notify(`Mazo listo: ${(await api('/api/host/deck', {})).size} cartas`));
  on('#guideNext', () => api('/api/host/guide', { delta: 1 }));
  on('#guidePrev', () => api('/api/host/guide', { delta: -1 }));
  on('#call', callCard);
  on('#ping', async () => notify(`Mensaje #${(await api('/api/host/ping', {})).n} enviado a ${st.counts.users} celulares`));
  on('#auto', () => { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } else { autoTimer = setInterval(() => callCard().catch(() => {}), 8000); } update(); });
  on('#mode', () => api('/api/host/mode', { mode: st.mode === 'line' ? 'full' : 'line' }));
  on('#backup', async () => { const r = await api('/api/host/credits-backup', {}); $('#backup').textContent = r.backup ? 'Créditos: usando respaldo (volver al principal)' : 'Créditos: cambiar al link de respaldo'; notify(r.backup ? 'La app ya usa el link de respaldo ✅' : 'La app volvió al link principal ✅'); });
  on('#seed', async () => { await api('/api/host/seed', { n: 54 }); notify('54 cartas falsas listas ✅'); });
  on('#reset', async () => { if (confirm('¿Reiniciar el juego? (las cartas se conservan)')) { await api('/api/host/reset', {}); notify('Juego reiniciado ✅'); } });
  on('#wipe', async () => { if (confirm('¿Borrar TODO? Se borran jugadores, cartas (también sus imágenes y voces del almacenamiento) y el juego. No se puede deshacer.')) { await api('/api/host/reset', { all: true }); notify('Todo borrado ✅'); } });
  if ($('#cards')) moderate();
  update();
}

let winnerCount = 0;
function update() {
  const c = st.counts, voices = st.deck.filter((x) => x.audio).length;
  $('#counts').innerHTML = `👥 ${c.users} · ☁️ ${c.credits} créditos · 🃏 ${c.cards} cartas · 🔥 ${c.queue} en el horno${st.deck.length ? ` · 🗣️ ${st.sung.length}/${st.deck.length} cantadas · 🎙️ voces ${voices}/${st.deck.length}` : ''}`;
  // Estado del paso: qué falta o qué sigue, en una línea
  const status = $('#status');
  if (st.phase === 'deck') {
    status.innerHTML = !st.deck.length ? `<p class="r">Faltan cartas: hay ${c.cards} y el mazo necesita 16. Siembra cartas falsas en “Más…” o espera a que hagan más.</p>`
      : voices < st.deck.length ? `<p class="mute">✅ Mazo de ${st.deck.length} cartas · ⏳ generando voces ${voices}/${st.deck.length}… cuando termine, pasa a ¡A cantar!</p>`
      : `<p class="g">✅ Mazo de ${st.deck.length} cartas con voz. ¡Listo para cantar!</p>`;
  } else if (st.phase === 'game' && !st.deck.length) status.innerHTML = '<p class="r">No hay mazo: regresa a “Mazo y tablas” (se arma solo al entrar).</p>';
  else if (st.phase === 'game' && st.voicesBusy) status.innerHTML = `<p class="mute">⏳ Generando voces ${voices}/${st.deck.length}… Cantar se activa al terminar.</p>`;
  else status.innerHTML = '';
  for (const id of ['#call', '#auto']) if ($(id)) $(id).disabled = !!st.voicesBusy || !st.deck.length;
  if ($('#call') && !$('#call').classList.contains('busy')) $('#call').textContent = st.voicesBusy ? `⏳ Generando voces ${voices}/${st.deck.length}…` : 'Cantar ▶';
  if ($('#mode')) $('#mode').textContent = `Gana: ${MODE[st.mode]} ⇄`;
  if ($('#auto')) $('#auto').textContent = autoTimer ? 'Detener auto ⏸' : 'Auto 8 s';
  if ($('#now')) { // la carta que se está cantando, para que el host pueda leerla en voz alta si el audio falla
    const last = st.deck.find((x) => x.id === st.sung.at(-1));
    $('#now').innerHTML = last ? `<div style="width:90px;font-size:9px;flex:none">${cardHTML(last)}</div><div><b style="font-size:20px">${esc(last.title)}</b><p style="font-style:italic">“${esc(last.verse)}”</p><p class="mute" style="font-size:13px">${esc(last.name)} · ${last.audio ? '🎙️ voz de Gemini' : '🔈 voz del navegador'}</p></div>` : '<p class="mute">Aún no se canta ninguna carta. Pulsa Cantar ▶ o la barra espaciadora.</p>';
  }
  $('#winners').innerHTML = st.winners.map((w) => `<li>🏆 ${esc(w.name)} — ${MODE[w.mode]} (${w.n} cartas)</li>`).join('');
  if (st.winners.length > winnerCount && autoTimer) { clearInterval(autoTimer); autoTimer = null; notify('¡Hay ganador! Auto en pausa 🎉'); }
  winnerCount = st.winners.length;
  // la moderación se refresca cuando cambia algo relevante: cartas, fila o jugadores
  const key = [c.cards, c.queue, c.users].join('|');
  if ($('#cards') && key !== moderate.key) moderate();
}
async function moderate() {
  const [cards, users] = await Promise.all([api('/api/host/cards'), api('/api/host/users')]);
  moderate.key = [st.counts.cards, st.counts.queue, st.counts.users].join('|');
  const STATUS = { null: 'sin empezar', queued: 'en fila', baking: 'en el horno', error: '❌ falló' };
  const pending = users.filter((u) => !u.hasCard); // las falsas del ensayo siempre traen carta
  // Cada pendiente es un botón: tocarlo reinicia sus intentos (para quien se atoró o le falló la foto)
  $('#pending').innerHTML = pending.length ? `Sin carta (${pending.length}), toca para reiniciar intentos: ` + pending.map((u) => `<button class="pill" data-uid="${esc(u.uid)}" style="margin:2px 4px 2px 0;font-size:14px;cursor:pointer;background:#fff">${esc(u.name)} · ${u.credits ? '' : 'sin créditos · '}${STATUS[u.status] ?? esc(u.status)}${u.error ? ': ' + esc(u.error) : ''} ↺</button>`).join('') : 'Todos los jugadores tienen carta ✅';
  $('#pending').onclick = guard(async (e) => { const b = e.target.closest('[data-uid]'); if (b && confirm(`¿Reiniciar a ${b.textContent.split(' ·')[0]}? Podrá hacer su carta desde cero.`)) { await api('/api/host/user/reset', { uid: b.dataset.uid }); moderate(); } });
  $('#cards').innerHTML = cards.map((c) => cardHTML(c).replace('class="card"', `class="card ${c.hidden ? 'off' : ''}" title="${esc(c.name)}: ${esc(c.verse)}"`)).join('');
  $('#cards').onclick = guard(async (e) => { const el = e.target.closest('.card'); if (el) { await api('/api/host/hide', { id: el.dataset.id }); moderate(); } });
}

addEventListener('keydown', (e) => {
  if (!st || e.target.matches('input')) return;
  const i = STEPS.findIndex((s) => s[0] === st.phase);
  if (e.key === 'ArrowRight' && i < STEPS.length - 1) setPhase(STEPS[i + 1][0]);
  if (e.key === 'ArrowLeft' && i > 0) setPhase(STEPS[i - 1][0]);
  if (e.key === ' ' && st.phase === 'game') { e.preventDefault(); callCard().catch((x) => notify(x.message)); }
});
