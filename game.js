// Lógica pura del juego: mazo, tablas, cantar y validar “¡Lotería!”.
export const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export const BOARD_SIZE = 16; // tabla de 4×4

// El mazo son TODAS las cartas de la sala, barajadas: así la carta de cada quien puede salir.
// (Con 400 jugadores y 400 cartas la primera línea cae a las ~50 cantadas: unos 7 min a 8 s por carta.)
export const buildDeck = (cardIds) => {
  if (cardIds.length < BOARD_SIZE) throw new Error(`Se necesitan al menos ${BOARD_SIZE} cartas (hay ${cardIds.length})`);
  return shuffle(cardIds);
};

export const deal = (deck) => shuffle(deck).slice(0, BOARD_SIZE);

export const nextCard = (deck, sung) => {
  const left = deck.filter((id) => !sung.includes(id));
  return left.length ? left[Math.floor(Math.random() * left.length)] : null;
};

// 4 filas, 4 columnas, 2 diagonales (índices sobre la tabla de 16)
const LINES = [
  ...[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => r * 4 + c)),
  ...[0, 1, 2, 3].map((c) => [0, 1, 2, 3].map((r) => r * 4 + c)),
  [0, 5, 10, 15], [3, 6, 9, 12],
];

// mode: 'line' (fila, columna o diagonal) o 'full' (tabla llena)
export const wins = (board, sung, mode) => {
  const s = new Set(sung);
  return mode === 'full' ? board.every((id) => s.has(id)) : LINES.some((l) => l.every((i) => s.has(board[i])));
};
