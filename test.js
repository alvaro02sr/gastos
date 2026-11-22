// Ejecutar: node test.js
const assert = require('assert');
const { parse, learn } = require('./parse.js');
const today = new Date(2026, 10, 22); // 22 nov 2026

const cases = [
  ['12,50 cena con Ana ayer', 12.5, 'Comida fuera', '2026-11-21'],
  ['40 euros de gasolina', 40, 'Transporte', '2026-11-22'],
  ['netflix 13.99', 13.99, 'Suscripciones', '2026-11-22'],
  ['amazon prime 4,99', 4.99, 'Suscripciones', '2026-11-22'],
  ['mercadona 56 euros con 30 anteayer', 56.3, 'Supermercado', '2026-11-20'],
  ['100 en fondo indexado', 100, 'Inversión', '2026-11-22'],
  ['hace 3 días pádel 8', 8, 'Deporte y salud', '2026-11-19'],
  ['farmacia 6', 6, 'Deporte y salud', '2026-11-22'],
  ['vuelo 100 con carmen y alvaro', 100, 'Ocio', '2026-11-22'],
  ['algo raro 5', 5, 'Otros', '2026-11-22'],
];
for (const [txt, amount, cat, date] of cases) {
  const r = parse(txt, today);
  assert.deepStrictEqual([r.amount, r.cat, r.date], [amount, cat, date], txt + ' -> ' + JSON.stringify(r));
}
assert.strictEqual(parse('12,50 cena con Ana ayer', today).desc, 'cena con Ana');
assert.strictEqual(parse('40 euros de gasolina', today).desc, 'gasolina');

// Aprendizaje: un concepto corregido antes gana a la palabra clave y recuerda el importe.
const mem = learn([
  { desc: 'Cañas con Pablo', cat: 'Ocio', amount: 10, date: '2026-11-01' },
  { desc: 'clase de guitarra', cat: 'Ocio', amount: 20, date: '2026-11-02' },
]);
assert.deepStrictEqual((({ amount, cat }) => ({ amount, cat }))(parse('cañas con pablo', today, mem)), { amount: 10, cat: 'Ocio' });
assert.strictEqual(parse('15 guitarra', today, mem).cat, 'Ocio');
console.log('OK', cases.length + 4, 'pruebas');
