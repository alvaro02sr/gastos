// Categorías: trazo SVG del icono, nombre corto, color y palabras clave (sin tildes, palabra completa).
const CATS = {
  'Alojamiento':     { p: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', s: 'Casa',     color: '#6366f1', kw: ['alquiler', 'hipoteca', 'piso', 'luz', 'agua', 'gas', 'internet', 'fibra', 'wifi', 'comunidad', 'hotel', 'airbnb', 'booking', 'hostal', 'seguro hogar', 'endesa', 'iberdrola', 'naturgy'] },
  'Supermercado':    { p: 'M3 4h2l2.4 11h11.1L21 7H6M9 20h.01M18 20h.01', s: 'Súper',    color: '#22c55e', kw: ['super', 'supermercado', 'mercadona', 'lidl', 'carrefour', 'aldi', 'alcampo', 'eroski', 'consum', 'hipercor', 'compra', 'fruta', 'fruteria', 'carniceria', 'panaderia', 'pan', 'leche'] },
  'Comida fuera':    { p: 'M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3', s: 'Fuera',    color: '#f97316', kw: ['restaurante', 'cena', 'cenar', 'comida', 'comer', 'almuerzo', 'desayuno', 'cafe', 'cafes', 'bar', 'cerveza', 'cervezas', 'cana', 'canas', 'vermut', 'burger', 'hamburguesa', 'mcdonalds', 'burger king', 'kfc', 'telepizza', 'pizza', 'glovo', 'just eat', 'uber eats', 'kebab', 'sushi', 'tapas', 'brunch', 'menu', 'bocadillo', 'starbucks', 'chino', 'japones', 'mexicano'] },
  'Ocio':            { p: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z', s: 'Ocio',     color: '#ec4899', kw: ['cine', 'concierto', 'fiesta', 'discoteca', 'copas', 'copa', 'entrada', 'entradas', 'viaje', 'vuelo', 'vuelos', 'ryanair', 'vueling', 'iberia', 'festival', 'videojuego', 'juego', 'steam', 'playstation', 'teatro', 'museo', 'bolos', 'escape room', 'karting', 'cumple', 'cumpleanos'] },
  'Transporte':      { p: 'M4 16v-4l2-6h12l2 6v4zM4 12h16M7 16v3M17 16v3', s: 'Transp.',  color: '#0ea5e9', kw: ['gasolina', 'gasolinera', 'repsol', 'cepsa', 'galp', 'diesel', 'gasoil', 'combustible', 'metro', 'bus', 'autobus', 'tren', 'renfe', 'ave', 'taxi', 'uber', 'cabify', 'bolt', 'blablacar', 'parking', 'aparcamiento', 'peaje', 'itv', 'taller', 'seguro coche', 'multa', 'bici', 'patinete', 'abono'] },
  'Suscripciones':   { p: 'M3 5h18v12H3zM8 21h8M10 8.5v5l4.5-2.5z', s: 'Suscr.',   color: '#a855f7', kw: ['netflix', 'spotify', 'hbo', 'disney', 'amazon prime', 'prime video', 'prime', 'youtube', 'icloud', 'google one', 'chatgpt', 'movil', 'tarifa', 'suscripcion', 'dazn', 'twitch', 'apple music', 'game pass', 'ps plus', 'filmin', 'movistar', 'vodafone', 'orange', 'digi'] },
  'Deporte y salud': { p: 'M3 12h4l3-8 4 16 3-8h4', s: 'Deporte',  color: '#14b8a6', kw: ['gimnasio', 'gym', 'padel', 'tenis', 'futbol', 'zapatillas', 'proteina', 'creatina', 'crossfit', 'piscina', 'yoga', 'pilates', 'running', 'decathlon', 'farmacia', 'medico', 'dentista', 'peluqueria', 'barberia', 'fisio', 'psicologo', 'optica', 'lentillas', 'crema', 'cosmetica'] },
  'Compras':         { p: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2', s: 'Compras',  color: '#eab308', kw: ['ropa', 'zara', 'primark', 'bershka', 'shein', 'amazon', 'aliexpress', 'regalo', 'cascos', 'zapatos', 'tecnologia', 'ordenador', 'movil nuevo', 'ikea', 'mediamarkt', 'fnac', 'libro', 'libros'] },
  'Inversión':       { p: 'M3 17l6-6 4 4 8-8M15 7h6v6', s: 'Invers.',  color: '#059669', kw: ['inversion', 'invertir', 'fondo', 'fondos', 'indexado', 'acciones', 'etf', 'cripto', 'bitcoin', 'ahorro', 'pensiones', 'curso', 'formacion', 'master', 'broker', 'trade republic', 'myinvestor'] },
  'Otros':           { p: 'M5 12h.01M12 12h.01M19 12h.01', s: 'Otros',    color: '#94a3b8', kw: [] },
};

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Más largas primero: "amazon prime" gana a "amazon".
const KW = Object.entries(CATS).flatMap(([c, v]) => v.kw.map(k => [new RegExp(`\\b${k}\\b`), c, k.length])).sort((a, b) => b[2] - a[2]);
const STOP = new Set(['con', 'para', 'del', 'los', 'las', 'una', 'unos', 'por', 'que', 'mis', 'tus', 'personas']);

// Memoria del usuario: último gasto por concepto exacto + recuento de categoría por palabra.
function learn(expenses) {
  const mem = { exact: {}, words: {} };
  for (const e of [...expenses].sort((a, b) => a.date.localeCompare(b.date))) {
    const n = norm(e.desc);
    mem.exact[n] = { cat: e.cat, amount: e.total || e.amount };
    for (const w of n.split(/\W+/)) if (w.length > 2 && !STOP.has(w)) (mem.words[w] ||= {})[e.cat] = (mem.words[w][e.cat] || 0) + 1;
  }
  return mem;
}

// "12,50 cena con Ana ayer" -> { amount, cat, desc, date }. Prioridad: concepto ya usado > palabra clave > palabra aprendida > Otros.
function parse(text, today = new Date(), mem = { exact: {}, words: {} }) {
  let t = ' ' + text.trim() + ' ';
  const d = new Date(today);
  const hace = t.match(/\bhace\s+(\d+)\s+d[ií]as?/i);
  if (hace) { d.setDate(d.getDate() - +hace[1]); t = t.replace(hace[0], ' '); }
  else for (const [re, back] of [[/\banteayer\b/i, 2], [/\bayer\b/i, 1], [/\bhoy\b/i, 0]])
    if (re.test(t)) { d.setDate(d.getDate() - back); t = t.replace(re, ' '); break; }

  let amount = null;
  const m = t.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur|pavos)?(?:\s+con\s+(\d{1,2})\b)?/i);
  if (m) {
    amount = parseFloat(m[1].replace(',', '.')) + (m[2] ? parseInt(m[2]) / (m[2].length === 1 ? 10 : 100) : 0);
    t = t.replace(m[0], ' ');
  }
  const desc = t.replace(/(€|\beuros?\b|\bpavos\b)/gi, ' ').replace(/^\s*(de|en|por|a)\s+/i, '').replace(/\s+/g, ' ').trim();
  const n = norm(desc);

  let cat = mem.exact[n]?.cat;
  if (cat && amount == null) amount = mem.exact[n].amount;
  cat ||= KW.find(([re]) => re.test(n))?.[1];
  if (!cat) {
    const score = {};
    for (const w of n.split(/\W+/)) for (const [c, k] of Object.entries(mem.words[w] || {})) score[c] = (score[c] || 0) + k;
    cat = Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  return { amount, cat: cat || 'Otros', desc, date: iso(d) };
}

if (typeof module !== 'undefined') module.exports = { parse, learn, CATS, iso, norm };
