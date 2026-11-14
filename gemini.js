// Todo lo de Gemini: arte de la carta, título + verso y la voz del gritón.
// Sin credenciales → modo ensayo (MOCK): no gasta nada y sirve para practicar.
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

const vertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
export const MOCK = process.env.MOCK === '1' || (!vertex && !process.env.GEMINI_API_KEY);
const ai = MOCK ? null : vertex
  ? new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: process.env.GOOGLE_CLOUD_LOCATION || 'global' })
  : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_IMAGE = process.env.MODEL_IMAGE || 'gemini-nano-banana-2.1';
const MODEL_TEXT = process.env.MODEL_TEXT || 'gemini-3.5-flash-lite';
const MODEL_TTS = process.env.MODEL_TTS || 'gemini-3.8-flash-tts';

// Las cartas que se pueden elegir (texto que ve el asistente, por eso en español). Son cosas del oficio, no personas:
// así nadie tiene que elegir género (como El Gallo o La Luna en la lotería de siempre) y la persona sale como protagonista con ese tema.
export const ARCHETYPES = ['El Código', 'La Nube', 'El Bug', 'El Deploy', 'La Terminal', 'El Café', 'El Commit', 'La API', 'El Pixel',
  'El Servidor', 'La Base de Datos', 'El Agente IA', 'El Prompt', 'El Hackatón', 'El WiFi', 'El Teclado', 'El 404', 'La Startup'];

// Detalle de Campeche que va de fondo en cada carta y da pie al verso: solo cosas de verdad campechanas
// (lugares, comida y tradiciones); nada de flamencos ni de otros estados.
const CAMPECHE_PLACES = ['la Puerta de Mar', 'la Puerta de Tierra', 'un baluarte con cañones', 'el malecón al atardecer', 'la pirámide de Edzná',
  'la selva de Calakmul con su jaguar', 'un pan de cazón', 'unos camarones al coco', 'un pámpano en escabeche', 'un sombrero de jipi de Bécal',
  'las casas de colores de la calle 59', 'el Fuerte de San Miguel', 'un barco pirata frente a la muralla', 'el tranvía “El Guapo”',
  'el Carnaval de Campeche, el más antiguo de México', 'una hamaca en un patio campechano', 'el Cristo Negro de San Román', 'los cenotes de Miguel Colorado'];

// Fondos lisos como los de la lotería de siempre (amarillo, azul, rosa, celeste…)
const CARD_BACKGROUNDS = ['amarillo intenso', 'azul medio', 'rosa', 'celeste', 'verde claro', 'naranja suave'];

let mockBusy = +process.env.MOCK_BUSY || 0;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Dos tamaños: arte para el proyector y miniatura ligera para las tablas en el celular.
const sizes = async (img) => ({
  art: await sharp(img).resize(600, 800, { fit: 'cover' }).webp({ quality: 80 }).toBuffer(),
  thumb: await sharp(img).resize(240, 320, { fit: 'cover' }).webp({ quality: 70 }).toBuffer(),
});

export async function cardArt(selfieB64, archetype) {
  const place = pick(CAMPECHE_PLACES), bg = pick(CARD_BACKGROUNDS);
  // Ensayo de saturación: MOCK_BUSY=N hace que las primeras N cartas respondan como Gemini con cuota llena (429)
  if (MOCK && mockBusy > 0) { mockBusy--; throw new Error('429 RESOURCE_EXHAUSTED (simulado)'); }
  if (MOCK) {
    const img = await sharp(Buffer.from(selfieB64, 'base64')).resize(600, 800, { fit: 'cover' })
      .grayscale().tint('#4285F4').toBuffer();
    return { ...(await sizes(img)), place };
  }
  const r = await ai.models.generateContent({
    model: MODEL_IMAGE,
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: 'image/jpeg', data: selfieB64 } },
      { text: `Retrato realista PINTADO al estilo de las cartas clásicas de la Lotería mexicana (litografía popular de principios del siglo XX, como La Dama o El Catrín): ` +
        `la persona de la foto con sus rasgos fieles y reconocibles (cara, peinado, lentes, barba, tono de piel), NO caricatura, pintada a mano con colores planos y saturados, ` +
        `suaves degradados de aerógrafo, paleta limitada (rojo, amarillo, azul, verde, rosa, café) y contorno fino. Sin sombras fotográficas ni efectos 3D. ` +
        `Pose frontal sencilla, de medio cuerpo, con ropa lisa sin logotipos ni letras. ` +
        `La carta se titula "${archetype}": la persona sostiene o lleva el objeto del título, dibujado grande y simple. ` +
        `FONDO de un solo color liso ${bg}, como mucho con una franja de piso. Nada de paisajes ni escenas. ` +
        `Un detalle pequeño y esquemático de Campeche (${place}) junto a la persona. ` +
        `Acabado de impresión antigua: ligero grano de papel y tintas un poco desalineadas. SIN texto, sin letras, sin números, sin marco: el marco lo ponemos nosotros. Formato vertical.` },
    ] }],
    config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4' } },
  });
  const part = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error('Gemini no regresó imagen (posible filtro de seguridad)');
  return { ...(await sizes(Buffer.from(part.inlineData.data, 'base64'))), place };
}

export async function verse(name, archetype, place = pick(CAMPECHE_PLACES)) {
  if (MOCK) return { title: archetype, verse: pick(['El que compila a la primera', 'Con café y sin dormir, el deploy va a salir',
    'Desde la muralla programa sin falla', 'Commit tras commit, nadie la hace como él']) };
  const r = await ai.models.generateContent({
    model: MODEL_TEXT,
    contents: `Crea el título y el verso cantado de una carta de Lotería mexicana para ${name}, cuya carta es "${archetype}" ` +
      `con ${place} de Campeche. Título ("title"): el de la carta, puede ajustarse un poco (máx. 4 palabras, con su artículo El/La). No asumas el género de la persona. ` +
      `Verso ("verse"): una frase corta, rimada y chistosa como las de la lotería tradicional (máx. 12 palabras) que mezcle tecnología con Campeche. ` +
      `Usa solo referencias reales de Campeche: su comida (pan de cazón, camarones, pámpano), su muralla y baluartes, piratas, Edzná, Calakmul, el malecón, el carnaval, el sombrero de jipi. ` +
      `Nada de flamencos, cenotes de Yucatán ni cosas de otros estados. Familiar y respetuoso. En español.`,
    config: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT',
      properties: { title: { type: 'STRING' }, verse: { type: 'STRING' } }, required: ['title', 'verse'] } },
  });
  return JSON.parse(r.text);
}

// El gritón: regresa WAV listo para <audio>, o null en ensayo (el proyector usa la voz del navegador).
export async function tts(text) {
  if (MOCK) return null;
  const r = await ai.models.generateContent({
    model: MODEL_TTS,
    // La dirección de estilo va entre corchetes al inicio: el modelo la obedece sin leerla (probado: en paréntesis o como frase sí la lee).
    contents: [{ role: 'user', parts: [{ text: `[${process.env.TTS_STYLE || 'Gritón de lotería de feria mexicana: voz alegre, con mucha energía, alargando las vocales del título como pregonero'}] ${text}` }] }],
    config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: process.env.VOICE || 'Puck' } } } },
  });
  const part = r.candidates[0].content.parts.find((p) => p.inlineData);
  const audio = Buffer.from(part.inlineData.data, 'base64');
  if (audio.subarray(0, 4).toString() === 'RIFF') return audio; // Vertex ya manda un WAV completo: tal cual
  // AI Studio manda PCM crudo (audio/L16;rate=24000): le ponemos cabecera WAV (16 bits, mono)
  const rate = +(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1] || 24000);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + audio.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(audio.length, 40);
  return Buffer.concat([header, audio]);
}

// Cartas falsas para ensayar sin selfies ni créditos.
export async function fakeArt(i) {
  const color = ['#4285F4', '#EA4335', '#F9AB00', '#34A853'][i % 4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#C3ECF6"/>
    <circle cx="300" cy="330" r="150" fill="${color}"/><rect x="150" y="520" width="300" height="220" rx="110" fill="${color}"/>
    <text x="300" y="370" font-size="120" text-anchor="middle" font-family="sans-serif" fill="#fff" font-weight="700">${i + 1}</text></svg>`;
  return sizes(Buffer.from(svg));
}
