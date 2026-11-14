import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, deal, nextCard, wins } from './game.js';

const ids = Array.from({ length: 60 }, (_, i) => `c${i}`);

test('mazo, tabla y cantar', () => {
  const deck = buildDeck(ids);
  assert.equal(deck.length, 60); // todas las cartas
  assert.equal(new Set(deal(deck)).size, 16);
  assert.throws(() => buildDeck(ids.slice(0, 10)));
  const sung = [];
  for (let c; (c = nextCard(deck, sung)); ) sung.push(c);
  assert.equal(sung.length, 60);
});

test('validar lotería', () => {
  const board = ids.slice(0, 16);
  assert.equal(wins(board, [], 'line'), false);
  assert.equal(wins(board, ['c0', 'c1', 'c2', 'c3'], 'line'), true); // fila
  assert.equal(wins(board, ['c1', 'c5', 'c9', 'c13'], 'line'), true); // columna
  assert.equal(wins(board, ['c3', 'c6', 'c9', 'c12'], 'line'), true); // diagonal
  assert.equal(wins(board, ['c0', 'c1', 'c2', 'c4'], 'line'), false);
  assert.equal(wins(board, ['c0', 'c1', 'c2', 'c3'], 'full'), false);
  assert.equal(wins(board, board, 'full'), true);
});
