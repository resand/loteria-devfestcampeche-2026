// Proyector: QR, muro en vivo, la carta cantada con voz, ganadores y resumen.
import { $, esc, api, stream, cardHTML, qr } from './common.js';

const stage = $('#stage');
const fit = () => (stage.style.transform = `translate(-50%,-50%) scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`);
addEventListener('resize', fit); fit();
// El navegador solo deja reproducir audio después de un gesto del usuario: un clic y listo.
$('#sound').onclick = (e) => { e.target.remove(); speechSynthesis.speak(new SpeechSynthesisUtterance('')); };

const cfg = await api('/api/config');
const brace = (t) => `<span class="brace">{</span> ${t} <span class="brace">}</span>`;
const head = (t) => `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:50px">
  <span class="t3" style="font-weight:700">${brace('Lotería DevFest Campeche')}</span><span class="dots"><i></i><i></i><i></i><i></i></span></div>${t}<div id="bursts"></div>`;
const stats = (s) => `<div class="stats">
  <div class="box stat"><b>${s.counts.users}</b>jugadores</div>
  <div class="box stat"><b class="b">${s.counts.cards}</b>cartas</div></div>`;

// Tutorial del canje: mismos pasos y capturas que la keynote (public/creditos/N.jpg)
const GUIDE = [
  ['Entra con tu Gmail', 'Escanea el QR y confirma tu cuenta <b>@gmail.com</b>.'],
  ['Claim Credit', 'Se abre <b>DevFest Campeche 2026</b>: toca el botón <b>Claim Credit</b>.'],
  ['Crea tu perfil', 'Te pide un perfil de Google Developer: toca <b>Create profile</b>.'],
  ['Completa tus datos', 'Nombre, ciudad y ocupación; acepta y envía el formulario.'],
  ['Verifica que eres tú', 'Toca <b>Clique para confirmar</b> en la verificación móvil.'],
  ['reCAPTCHA', 'En iPhone puede abrirse aparte: toca <b>Abrir</b> y regresa al navegador.'],
  ['¡Crédito reclamado!', 'Toca <b>Claim Credit</b> y sale la confirmación. Si ya lo tenías, dice <b>“already claimed”</b>. El link vale <b>12 horas</b>.'],
  ['Elige la cuenta del crédito', 'En Google Cloud, arriba a la izquierda abre <b>Sus cuentas de facturación</b> y elige <b>GDP Event Credit: DevFest Campeche 2026</b> (hasta 5 min). Es la que usaremos para desplegar.'],
];
const COLORS = ['var(--blue)', 'var(--red)', 'var(--yellow)', 'var(--green)'];
function paintGuide(n) {
  document.querySelectorAll('.walk-step, .walk-phone img').forEach((e) => e.classList.toggle('on', +e.dataset.n === n));
  document.querySelectorAll('.walk-dots i').forEach((d, i) => (d.style.opacity = i <= n ? 1 : .15));
}

// Una vista por fase del juego (las cambia el host).
const VIEWS = {
  welcome: (s) => head(`<div class="row"><div style="flex:1"><p class="t1">Haz tu carta<br>de <span class="b">lotería</span><br>con Gemini.</p>
    <p class="t3 mute" style="margin-top:30px">Escanea y entra con tu Gmail personal.</p><div id="stats">${stats(s)}</div>
    <p class="t2" style="margin-top:30px">🙋 <span id="presentCount" class="g">${s.present?.count || 0}</span> presentes</p></div>
    <img class="qr" src="${qr(cfg.appUrl)}"></div>`),
  credits: (s) => head(`<div class="row"><div style="flex:1"><p class="t2">¿Ya canjeaste tus créditos<br>de <span class="b">Google Cloud</span>?</p>
    <ol class="t3" style="margin:24px 0;line-height:1.45;font-size:33px"><li>Escanea <b>Canjea</b> y entra con tu cuenta <b>@gmail.com</b></li><li>Toca <b>Claim Credit</b></li><li>Crea tu <b>perfil de Google Developer</b> (nombre y datos) y envíalo</li><li>Confirma el <b>reCAPTCHA</b> y toca otra vez <b>Claim Credit</b></li><li>Escanea <b>Entra a la app</b> y marca “Ya los canjeé ✅”</li></ol>
    <p class="t3 mute">¿Ya canjeaste en la keynote? Solo marca “Ya los canjeé ✅”</p>
    <div id="stats">${stats(s)}</div></div>
    <div style="display:flex;flex-direction:column;gap:14px;text-align:center;flex:none">${s.creditsUrl ? `<div><img class="qr" id="creditsQr" style="width:330px;height:330px" src="${qr(s.creditsUrl)}"><p class="t3" style="font-weight:700">Canjea (el de la keynote)</p></div>` : ''}
      <div><img class="qr" style="width:330px;height:330px" src="${qr(cfg.appUrl)}"><p class="t3" style="font-weight:700">Entra a la app</p></div></div></div>`),
  creditsGuide: (s) => head(`<div class="row" style="align-items:stretch;gap:80px"><div style="flex:1;position:relative">
      <div class="walk-dots">${GUIDE.map((_, i) => `<i style="background:${COLORS[i % 4]}"></i>`).join('')}</div>
      ${GUIDE.map(([t, x], i) => `<div class="walk-step" data-n="${i}"><span class="pill" style="font-size:40px;padding:8px 32px;background:${COLORS[i % 4]};color:${i % 4 === 2 ? 'var(--ink)' : '#fff'}">Paso ${i + 1} de ${GUIDE.length}</span><p class="t1" style="font-size:88px;margin:24px 0 14px">${t}</p><p class="t3" style="font-size:42px;line-height:1.25">${x}</p></div>`).join('')}
      ${s.creditsUrl ? `<div style="position:absolute;left:0;bottom:0;display:flex;align-items:center;gap:22px"><img class="qr" id="creditsQr" style="width:230px;height:230px;padding:10px" src="${qr(s.creditsUrl)}"><span class="t3 mute" style="font-size:30px">¿Aún no entras? Escanea</span></div>` : ''}
    </div><div class="walk-phone">${GUIDE.map((_, i) => `<img data-n="${i}" src="creditos/${i + 1}.jpg" alt="">`).join('')}</div></div>`),
  deploy: () => head(`<div class="row" style="align-items:flex-start;gap:50px">
    <div style="width:720px;flex:none"><p class="t2" style="margin-bottom:22px">Así se <span class="b">despliega</span></p>
      <ol class="t3" style="line-height:1.5;padding-left:40px;font-size:31px">
        <li><b>Proyecto</b> en Google Cloud con tus créditos</li>
        <li><b>Google Auth Platform</b>: marca + cliente OAuth (el login con Google)</li>
        <li><b>.env</b>: PROJECT, HOST_KEY, GOOGLE_CLIENT_ID y tu Gmail como host</li>
        <li><span class="cmd-inline">./scripts/setup.sh</span> → APIs, bucket, cuenta de servicio con permiso a Gemini</li>
        <li><span class="cmd-inline">./scripts/deploy.sh</span> → Cloud Run te da la URL</li>
      </ol>
      <p class="t3 mute" style="margin-top:22px;font-size:28px">Sin claves de API: Cloud Run habla con Gemini por Vertex AI con su cuenta de servicio.<br>El servidor valida cada “¡Lotería!”.</p></div>
    <div style="flex:1"><svg viewBox="0 0 960 600" width="100%" font-family="Google Sans, sans-serif"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#1E1E1E"/></marker></defs>
<rect x="20" y="40" width="270" height="120" rx="26" fill="#C3ECF6" stroke="#1E1E1E" stroke-width="4"/><text x="155" y="88" text-anchor="middle" dominant-baseline="central" font-size="30" font-weight="700" fill="#1E1E1E">📱 400 celulares</text><text x="155" y="126" text-anchor="middle" dominant-baseline="central" font-size="21" fill="#575757">login · selfie · tabla</text>
<rect x="20" y="440" width="270" height="110" rx="26" fill="#C3ECF6" stroke="#1E1E1E" stroke-width="4"/><text x="155" y="483" text-anchor="middle" dominant-baseline="central" font-size="30" font-weight="700" fill="#1E1E1E">🖥️ Proyector</text><text x="155" y="521" text-anchor="middle" dominant-baseline="central" font-size="21" fill="#575757">/screen · muro · cantar</text>
<rect x="355" y="240" width="250" height="130" rx="26" fill="#FFFFFF" stroke="#1E1E1E" stroke-width="4"/><text x="480" y="293" text-anchor="middle" dominant-baseline="central" font-size="30" font-weight="700" fill="#1E1E1E">Cloud Run</text><text x="480" y="331" text-anchor="middle" dominant-baseline="central" font-size="21" fill="#575757">1 instancia · Node · SSE</text>
<rect x="690" y="40" width="250" height="120" rx="26" fill="#FFFFFF" stroke="#1E1E1E" stroke-width="4"/><text x="815" y="88" text-anchor="middle" dominant-baseline="central" font-size="30" font-weight="700" fill="#1E1E1E">Gemini</text><text x="815" y="126" text-anchor="middle" dominant-baseline="central" font-size="21" fill="#575757">imagen · verso · voz</text>
<rect x="690" y="260" width="250" height="110" rx="26" fill="#FFFFFF" stroke="#1E1E1E" stroke-width="4"/><text x="815" y="303" text-anchor="middle" dominant-baseline="central" font-size="30" font-weight="700" fill="#1E1E1E">Cloud Storage</text><text x="815" y="341" text-anchor="middle" dominant-baseline="central" font-size="21" fill="#575757">cartas · voces · estado</text>
<rect x="690" y="460" width="250" height="110" rx="26" fill="#FFFFFF" stroke="#1E1E1E" stroke-width="4"/><text x="815" y="503" text-anchor="middle" dominant-baseline="central" font-size="30" font-weight="700" fill="#1E1E1E">Google Sign-In</text><text x="815" y="541" text-anchor="middle" dominant-baseline="central" font-size="21" fill="#575757">1 carta por persona</text>
<line x1="290" y1="120" x2="355" y2="260" stroke="#4285F4" stroke-width="5" marker-end="url(#a)"/><text x="270" y="215" text-anchor="middle" font-size="22" font-weight="600" fill="#4285F4" paint-order="stroke" stroke="#F0F0F0" stroke-width="8">selfie ↑ · tiempo real ↓</text>
<line x1="355" y1="350" x2="290" y2="470" stroke="#34A853" stroke-width="5" marker-end="url(#a)"/><text x="260" y="400" text-anchor="middle" font-size="22" font-weight="600" fill="#34A853" paint-order="stroke" stroke="#F0F0F0" stroke-width="8">cartas · voz</text>
<line x1="605" y1="270" x2="690" y2="120" stroke="#EA4335" stroke-width="5" marker-end="url(#a)"/><text x="690" y="210" text-anchor="middle" font-size="22" font-weight="600" fill="#EA4335" paint-order="stroke" stroke="#F0F0F0" stroke-width="8">Vertex AI · sin claves</text>
<line x1="605" y1="310" x2="690" y2="315" stroke="#F9AB00" stroke-width="5" marker-end="url(#a)"/><text x="648" y="295" text-anchor="middle" font-size="22" font-weight="600" fill="#F9AB00" paint-order="stroke" stroke="#F0F0F0" stroke-width="8">respaldo</text>
<line x1="605" y1="345" x2="690" y2="490" stroke="#1E1E1E" stroke-width="5" marker-end="url(#a)"/><text x="700" y="420" text-anchor="middle" font-size="22" font-weight="600" fill="#1E1E1E" paint-order="stroke" stroke="#F0F0F0" stroke-width="8">verifica el token</text>
<text x="480" y="585" text-anchor="middle" font-size="22" fill="#575757">setup.sh prepara el proyecto · deploy.sh lo sube a Cloud Run</text></svg></div></div>`),
  sse: () => head(`<div class="row" style="align-items:flex-start;gap:60px">
    <div style="flex:1.1"><p class="t2" style="margin-bottom:18px">Tiempo real: <span class="b">SSE</span></p>
      <p class="t3" style="font-size:30px;line-height:1.45;margin-bottom:18px"><b>Server-Sent Events</b>: el servidor deja abierta una petición HTTP y va <b>empujando</b> mensajes de texto; el navegador los recibe al instante.</p>
      <ul class="t3" style="font-size:27px;line-height:1.45;padding-left:34px">
        <li><b>Estándar web</b> (WHATWG / HTML Living Standard), no de Google. Propuesto en 2004 por Ian Hickson; Opera lo estrenó en 2006. Hoy en todos los navegadores.</li>
        <li>HTTP de toda la vida: respuesta <span class="cmd-inline" style="font-size:22px">text/event-stream</span> con líneas <span class="cmd-inline" style="font-size:22px">data:</span>. Pasa por cualquier red, CDN o proxy.</li>
        <li>Nativo en el navegador: <span class="cmd-inline" style="font-size:22px">new EventSource(url)</span>. Se <b>reconecta solo</b> y retoma con <span class="cmd-inline" style="font-size:22px">Last-Event-ID</span>.</li>
        <li><b>Quién lo usa</b>: así llega palabra por palabra la respuesta de ChatGPT, de la API de Gemini (<span class="cmd-inline" style="font-size:22px">alt=sse</span>) y de la API de Claude. Notificaciones, feeds, tableros en vivo.</li>
        <li>Aquí: 1 conexión por celular, ~400 abiertas en una instancia; cada carta cantada llega a todos en ~300 ms.</li>
      </ul></div>
    <div style="flex:1"><p class="t2" style="margin-bottom:18px">SSE <span class="mute">vs</span> WebSockets</p>
      <table class="cmp"><tr><th></th><th>SSE</th><th>WebSockets</th></tr>
        <tr><td>Estándar</td><td>WHATWG (HTML)</td><td>IETF RFC 6455 (2011)</td></tr>
        <tr><td>Dirección</td><td>servidor → cliente</td><td>ambas (full-duplex)</td></tr>
        <tr><td>Transporte</td><td>HTTP normal</td><td>protocolo propio (ws://), con “upgrade”</td></tr>
        <tr><td>Datos</td><td>texto (UTF-8)</td><td>texto y binario</td></tr>
        <tr><td>Reconexión</td><td>automática</td><td>la programas tú</td></tr>
        <tr><td>Infra</td><td>cualquier servidor HTTP</td><td>balanceadores y proxies con soporte WS</td></tr>
        <tr><td>Ideal para</td><td>avisos, streams, tableros</td><td>chat, juegos de acción, colaboración</td></tr></table>
      <p class="t3 mute" style="font-size:26px;margin-top:18px">Regla: si el cliente solo necesita <b>recibir</b>, SSE. Lo que el cliente manda (selfie, “¡Lotería!”) va por POST normal.</p></div></div>`),
  sseDemo: (s) => head(`<div class="row" style="align-items:flex-start;gap:50px">
    <div style="width:860px;flex:none"><p class="t2" style="margin-bottom:18px;font-size:56px">Todo el <span class="b">tiempo real</span>, en 10 líneas</p>
      <div class="cmd" style="font-size:22px;line-height:1.45;padding:24px 32px"><i>// navegador (common.js) — recibe</i><br>const es = new EventSource('/api/stream');<br>es.onmessage = (e) =&gt; render(JSON.parse(e.data));<br><br><i>// servidor (server.js) — empuja</i><br>app.get('/api/stream', (req, res) =&gt; {<br>&nbsp;&nbsp;res.writeHead(200, { 'Content-Type': 'text/event-stream' });<br>&nbsp;&nbsp;clients.add(res);<br>});<br>const broadcast = () =&gt; { for (const res of clients) res.write('data: ' + JSON.stringify(state) + '\\n\\n'); };</div>
      <p class="t3 mute" style="font-size:26px;margin-top:16px">Cada cambio (carta nueva, carta cantada, ganador) → <b>broadcast()</b> → llega a todos a la vez.</p>
      <div class="cmd" id="sselog" style="font-size:20px;margin-top:14px;min-height:96px;padding:18px 32px"><i>// últimos mensajes recibidos por ESTA pantalla</i></div></div>
    <div style="flex:1"><p class="t2" style="margin-bottom:10px">En vivo: <span class="g" id="ssecount">${s.counts.users}</span> celulares conectados</p>
      <svg id="ssenet" viewBox="0 0 800 640" width="100%"></svg></div></div>`),
  cards: (s) => head(`<div class="row" style="align-items:flex-start"><div style="width:420px;flex:none"><p class="t2">El muro</p>
    <img class="qr" style="width:300px;height:300px;margin:30px 0" src="${qr(cfg.appUrl)}"><div id="stats">${stats(s)}</div></div>
    <div class="grid" id="wall" style="flex:1;grid-template-columns:repeat(8,1fr)"></div></div>`),
  deck: (s) => head(`<p class="t2" style="margin-bottom:30px">El mazo: <span class="b">${s.deck.length}</span> cartas de ustedes · revisa tu tabla 📱</p>
    <p class="t3 mute" id="voicesLine" style="margin:-14px 0 24px"></p>
    <div class="grid" style="grid-template-columns:repeat(14,1fr);font-size:8px">${s.deck.slice(0, 84).map((c) => cardHTML(c)).join('')}</div>
    ${s.deck.length > 84 ? `<p class="t3 mute" style="margin-top:20px">…y ${s.deck.length - 84} más</p>` : ''}`),
  game: () => head(`<div class="row" style="align-items:flex-start"><div class="big" id="big"><p class="t2 mute">¿Listos? 🫘</p></div>
    <div style="flex:1"><p class="t3" id="count" style="margin-bottom:8px"></p><p class="t3 mute" id="voice" style="margin-bottom:20px;font-size:26px"></p><div class="history" id="history"></div></div></div>`),
  results: (s) => {
    const top = (mode) => s.winners.filter((w) => w.mode === mode).slice(0, 3);
    const deck = Object.fromEntries(s.deck.map((c) => [c.id, c]));
    const podium = (ws) => `<div class="podium">${[1, 0, 2].map((i) => ws[i] && `<div>${ws[i].cardId ? cardHTML(deck[ws[i].cardId] || { id: ws[i].cardId, n: '', title: ws[i].name }, '') : `<div class="card" style="place-content:center;font-size:120px">${esc(ws[i].name[0] || '?')}</div>`}
      ${['🥇', '🥈', '🥉'][i]} ${esc(ws[i].name)}<p class="t3 mute">${ws[i].n} cartas</p></div>`).join('')}</div>`;
    return head(`<div class="row" style="align-items:flex-start;gap:80px"><div><p class="t2" style="margin-bottom:30px">¡Ganadores! 🏆</p>
      ${top('line').length ? podium(top('line')) : '<p class="t3 mute">Sin ganadores aún</p>'}
      ${top('full').length ? `<p class="t3" style="margin:30px 0 10px"><b>Tabla llena:</b> ${top('full').map((w) => esc(w.name)).join(', ')}</p>` : ''}</div>
      <div><p class="t2" style="margin-bottom:30px">Resumen</p><div class="box t3" style="line-height:1.8">
      👥 <b>${s.counts.users}</b> jugadores<br>🃏 <b>${s.counts.cards}</b> cartas hechas con Gemini<br>
      🗣️ <b>${s.sung.length}</b> cartas cantadas<br>⏱️ <b>${s.minutes}</b> min de juego</div></div></div>`);
  },
  repo: (s) => head(`<div class="row"><div style="flex:1"><p class="t1">Ahora<br>hazlo <span class="g">tú</span>.</p>
    <p class="t3" style="margin-top:30px">Repo + tutorial paso a paso. Despliégalo con tus créditos.</p></div>
    ${cfg.repoUrl ? `<div style="text-align:center"><img class="qr" src="${qr(cfg.repoUrl)}"><p class="t3" style="margin-top:12px">Repo</p></div>` : ''}
    ${s.creditsUrl ? `<div style="text-align:center"><img class="qr" src="${qr(s.creditsUrl)}"><p class="t3" style="margin-top:12px">Créditos</p></div>` : ''}</div>`),
};

// ---- Demo SSE: dibuja hasta 24 celulares alrededor del servidor y anima cada mensaje que llega ----
let pingN = null;
function sseNet(s) {
  const svg = $('#ssenet'); if (!svg) return;
  const n = Math.min(24, Math.max(1, s.counts.users)), cx = 400, cy = 330, R = 260;
  if (+svg.dataset.n !== n) {
    svg.dataset.n = n;
    svg.innerHTML = `<rect x="300" y="280" width="200" height="100" rx="24" fill="#fff" stroke="#1E1E1E" stroke-width="4"/><text x="400" y="322" text-anchor="middle" font-size="26" font-weight="700" fill="#1E1E1E">Cloud Run</text><text x="400" y="352" text-anchor="middle" font-size="18" fill="#575757">/api/stream</text>` +
      Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, x = (cx + Math.cos(a) * R).toFixed(0), y = (cy + Math.sin(a) * R).toFixed(0);
        return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#C3ECF6" stroke-width="3"/><circle class="dot" r="11" fill="#4285F4" data-x="${x}" data-y="${y}" cx="${cx}" cy="${cy}" opacity="0"/><text class="ph" x="${x}" y="${+y + 8}" text-anchor="middle" font-size="46">📱</text>`; }).join('');
  }
  $('#ssecount').textContent = s.counts.users;
  if (s.ping && s.ping.n !== pingN) { // llegó un mensaje: viaja del servidor a cada celular, el celular “salta” y queda en el log
    pingN = s.ping.n;
    const log = $('#sselog');
    log.insertAdjacentHTML('beforeend', `<br>${new Date().toLocaleTimeString()} ← data: {"ping":{"n":${s.ping.n}},"counts":{"users":${s.counts.users}}, …}`);
    while (log.childNodes.length > 9) log.childNodes[1].remove();
    svg.querySelectorAll('.dot').forEach((d) => {
      d.setAttribute('opacity', 1);
      d.animate([{ cx: `${cx}px`, cy: `${cy}px` }, { cx: `${d.dataset.x}px`, cy: `${d.dataset.y}px` }], { duration: 700, easing: 'ease-out', fill: 'forwards' }).onfinish = () => d.setAttribute('opacity', 0);
    });
    svg.querySelectorAll('.ph').forEach((p) => p.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 500, delay: 700 }));
  }
}

let st, phase, shown = new Set(), sungCount = 0, winnerCount = -1, lastPresentAt = Date.now();
function burst(text, seed) {
  const el = document.createElement('b'); el.className = 'burst ' + ['b', 'r', 'y', 'g'][seed % 4];
  el.textContent = text; el.style.left = 8 + Math.random() * 55 + '%'; el.style.top = 35 + Math.random() * 50 + '%';
  $('#bursts').append(el); setTimeout(() => el.remove(), 1800);
} // -1: aún no sabemos cuántos había (no festejar al recargar)
function callCard(c) {
  $('#big').innerHTML = `${cardHTML(c, '')}<p class="t3" style="margin-top:16px;font-style:italic">“${esc(c.verse)}”</p>`;
  const a = c.audio && new Audio(`/audio/${c.id}`);
  $('#voice').textContent = a ? '🎙️ Voz: Gemini TTS' : '🔈 Voz del navegador (respaldo)'; // que la sala vea que el gritón es Gemini
  if (a) a.play().catch(() => speak(c)); else speak(c);
}
// Mejor voz en español del sistema: primero México, sin las voces “de broma” de macOS (Eddy, Flo, Grandma…) que suenan raro.
const NOVELTY_VOICES = /Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Bells|Bubbles|Organ|Trinoids|Zarvox|Whisper|Wobble|Good News|Bad News|Cellos|Boing|Jester|Albert|Fred|Junior|Kathy|Ralph|Superstar|Bahh|Hysterical|Pipe/i;
const bestVoice = () => {
  const voices = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang) && !NOVELTY_VOICES.test(v.name));
  return voices.find((v) => /es[-_]MX/i.test(v.lang) && /Paulina|Google/i.test(v.name)) || voices.find((v) => /es[-_]MX/i.test(v.lang))
    || voices.find((v) => /es[-_]US|es[-_]419/i.test(v.lang)) || voices.find((v) => /Mónica|Monica|Google/i.test(v.name)) || voices[0] || null;
};
let utterance; // referencia viva: Chrome se traga el utterance si el GC lo recoge antes de hablar (y cancel()+speak() seguidos lo cortan)
function speak(c) { // voz del navegador como respaldo (ensayo o si el TTS de Gemini aún no está)
  utterance = new SpeechSynthesisUtterance(`${c.verse}. ¡${c.title}!`); utterance.lang = 'es-MX'; utterance.rate = 1.05;
  utterance.voice = bestVoice();
  speechSynthesis.cancel(); setTimeout(() => speechSynthesis.speak(utterance), 80);
}

stream((s) => {
  if (s.phase !== phase) { phase = s.phase; stage.innerHTML = VIEWS[phase](s); shown = new Set(); sungCount = 0; }
  st = s;
  if ($('#stats')) $('#stats').innerHTML = stats(s);
  if ($('#creditsQr')) $('#creditsQr').src = qr(s.creditsUrl); // si el host cambia al link de respaldo
  if (phase === 'creditsGuide') paintGuide(s.guideStep);
  if (phase === 'sseDemo') sseNet(s);
  // Mientras Gemini prepara las voces, el público ve que el gritón se está calentando (no una pantalla muerta)
  const ready = s.deck.filter((x) => x.audio).length, warming = s.voicesBusy && s.deck.length;
  if ($('#voicesLine')) $('#voicesLine').textContent = warming ? `🎙️ Gemini está preparando la voz del gritón… ${ready}/${s.deck.length}` : s.deck.length ? '🎙️ El gritón está listo' : '';
  if (phase === 'game' && !s.sung.length && $('#big')) $('#big').innerHTML = warming
    ? `<p class="t2">🎙️ Calentando la voz…</p><p class="t3 mute" style="margin-top:16px">Gemini prepara al gritón: ${ready} de ${s.deck.length}</p>`
    : '<p class="t2 mute">¿Listos? 🫘</p>';
  if (phase === 'welcome' && s.present) { // cada “¡Presente!” nuevo estalla con su nombre
    $('#presentCount').textContent = s.present.count;
    for (const p of s.present.last) if (p.at > lastPresentAt) {
      lastPresentAt = p.at;
      burst('🙋 ' + p.name, p.at);
    }
  }
  const wall = $('#wall');
  if (wall) for (const c of [...s.recent].reverse()) if (!shown.has(c.id)) {
    shown.add(c.id); wall.insertAdjacentHTML('afterbegin', cardHTML(c));
    while (wall.children.length > 24) wall.lastElementChild.remove();
  }
  if (phase === 'game') {
    const deck = Object.fromEntries(s.deck.map((c) => [c.id, c]));
    if (s.sung.length !== sungCount) {
      sungCount = s.sung.length;
      $('#history').innerHTML = [...s.sung].reverse().map((id) => cardHTML(deck[id])).join('');
      $('#count').innerHTML = `Cantadas: <b>${sungCount}</b> de ${s.deck.length} · Gana: <b>${s.mode === 'full' ? 'tabla llena' : 'línea'}</b>`;
      const last = deck[s.sung.at(-1)];
      if (last) callCard(last); // si la carta ya no está en el mazo (oculta/borrada), no truena la pantalla
    }
  }
  if (winnerCount >= 0 && s.winners.length > winnerCount && phase === 'game') {
    const w = s.winners.at(-1);
    stage.insertAdjacentHTML('beforeend', `<div class="win"><div><p class="t1">¡LOTERÍA! 🎉</p><p class="t2" style="margin-top:30px">${esc(w.name)}</p>
      <p class="t3" style="margin-top:20px">${w.mode === 'full' ? 'Tabla llena' : 'Línea'} con ${w.n} cartas · lugar ${new Set(s.winners.filter((x) => x.mode === w.mode && x.n < w.n).map((x) => x.n)).size + 1}${s.winners.filter((x) => x.mode === w.mode && x.n === w.n).length > 1 ? ' (empate)' : ''}</p></div></div>`);
    setTimeout(() => document.querySelector('.win')?.remove(), 6000);
  }
  winnerCount = s.winners.length;
});
