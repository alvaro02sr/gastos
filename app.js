// shortcut: datos en localStorage de este navegador; para compartir entre móviles hace falta un backend.
const KEY = 'gastos-v1';
let db = null;
try { db = JSON.parse(localStorage.getItem(KEY)); } catch {}
db ||= { users: [], expenses: [], current: null };
db.expenses.forEach(e => { if (e.cat === 'Deporte' || e.cat === 'Salud y cuidado') e.cat = 'Deporte y salud'; });
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { alert('No se pudo guardar'); } };

// Solo dos personas usan la app. Se reutilizan usuarios ya creados con ese nombre.
const PEOPLE = [{ key: 'carmen', name: 'Carmen', color: '#ff2d55' }, { key: 'alvaro', name: 'Álvaro', color: '#0a84ff' }];
for (const p of PEOPLE) {
  const u = db.users.find(u => norm(u.name) === p.key);
  p.id = u ? u.id : p.key;
  if (!u) db.users.push({ id: p.key, name: p.name, friends: [] });
}
if (!PEOPLE.some(p => p.id === db.current)) db.current = PEOPLE[0].id;
save();

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const eur = n => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const person = id => PEOPLE.find(p => p.id === id);
const ym = d => iso(d).slice(0, 7);
const C = c => CATS[c] || CATS.Otros;
const sum = a => a.reduce((s, e) => s + e.amount, 0);
const mine = () => db.expenses.filter(e => e.userId === db.current);
const svg = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const ic = c => `<span class="ic" style="--c:${C(c).color}">${svg(C(c).p)}</span>`;
const I = { mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3', l: 'M15 18l-6-6 6-6', r: 'M9 18l6-6-6-6', x: 'M6 6l12 12M18 6L6 18', users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' };
const monthName = d => d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

let tab = 'resumen', detail = null, over = {}, lastKey = '';
const month = new Date(); month.setDate(1);

// Personas cuyo nombre aparece en el texto -> gasto compartido.
function detectSplit(text) {
  const n = norm(text);
  return [db.current, ...PEOPLE.filter(p => p.id !== db.current && new RegExp(`\\b${p.key}\\b`).test(n)).map(p => p.id)];
}

function draft() {
  const txt = $('#q').value;
  const p = parse(txt, new Date(), learn(mine()));
  return { ...p, cat: over.cat || p.cat, date: over.date || p.date, split: over.split || detectSplit(txt) };
}

function commit(p, voice) {
  if (!p.amount) return toast('Falta el importe. Ej: "12 cena"');
  // shortcut: reparto a partes iguales con redondeo a céntimos; importes distintos por persona si se necesita.
  const share = Math.round(p.amount / p.split.length * 100) / 100;
  const group = p.split.length > 1 ? uid() : null;
  const added = p.split.map(userId => ({ id: uid(), userId, amount: share, cat: p.cat, desc: p.desc || p.cat, date: p.date, ...(group && { group, total: p.amount, with: p.split }) }));
  db.expenses.push(...added); save();
  over = {}; $('#q').value = ''; $('#q').blur(); sheet(); render();
  toast(`${voice ? 'Dictado · ' : ''}${eur(p.amount)} · ${p.cat}${group ? ' · compartido' : ''}`,
    () => { db.expenses = db.expenses.filter(x => !added.includes(x)); save(); render(); });
}

// Gastos más repetidos (últimos 90 días) como botones de un toque.
function frequent() {
  const since = new Date(); since.setDate(since.getDate() - 90);
  const map = {};
  mine().filter(e => e.date >= iso(since)).sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
    const k = norm(e.desc); map[k] = { ...e, amount: e.total || e.amount, n: (map[k]?.n || 0) + 1 };
  });
  return Object.values(map).sort((a, b) => b.n - a.n).slice(0, 8);
}

function sheet() {
  if (!$('#q').value.trim()) {
    const f = frequent();
    $('#sheet').innerHTML = f.length ? `<div class="chips">${f.map((e, i) => `<button data-quick="${i}" style="color:${C(e.cat).color}">${svg(C(e.cat).p)}<span style="color:var(--text)">${esc(e.desc)} · ${eur(e.amount)}</span></button>`).join('')}</div>` : '';
    $('#sheet').quick = f;
    return;
  }
  const p = draft();
  $('#sheet').innerHTML = `
    <div class="draft"><b>${p.amount ? eur(p.amount) : '— €'}</b><span class="muted">${esc(p.desc)}</span></div>
    <div class="cats">${Object.keys(CATS).map(c => `<button type="button" data-cat="${c}" class="${c === p.cat ? 'on' : ''}" style="--c:${CATS[c].color}">${svg(CATS[c].p)}<small>${CATS[c].s}</small></button>`).join('')}</div>
    <div class="chips"><button type="button" disabled aria-label="Compartir con">${svg(I.users)}</button>${PEOPLE.map(u => `<button type="button" data-split="${u.id}" class="${p.split.includes(u.id) ? 'on' : ''}" style="--pc:${u.color}">${u.name}</button>`).join('')}</div>
    <div class="opts"><input type="date" id="pd" value="${p.date}" aria-label="Fecha">
      ${p.split.length > 1 && p.amount ? `<small class="muted">${eur(p.amount / p.split.length)} c/u</small>` : ''}
      <button type="button" data-cancel style="margin-left:auto">Cancelar</button>
      <button class="pri" type="submit" form="add" style="margin-left:0">Guardar</button></div>`;
}

let toastT;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (undo ? '<button>Deshacer</button>' : '');
  t.classList.add('show');
  if (undo) t.querySelector('button').onclick = () => { undo(); t.classList.remove('show'); };
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 4000);
}

// ---------- Vistas ----------
const kpi = (label, v, extra = '', color = '') => `<div class="card glass kpi"><small>${label}</small><b ${color ? `style="color:${color}"` : ''} data-count="${v}">${eur(v)}</b>${extra}</div>`;
// Barras apiladas por categoría. Mismo orden en todas: la categoría con más gasto del periodo siempre abajo.
const vbars = items => {
  const tot = {};
  items.forEach(([, es]) => es.forEach(e => tot[e.cat] = (tot[e.cat] || 0) + e.amount));
  const order = Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
  const m = Math.max(1, ...items.map(x => sum(x[1])));
  return `<div class="vbars">${items.map(([l, es, now], j) => {
    const v = sum(es);
    const segs = order.map(c => { const cv = sum(es.filter(e => e.cat === c)); return cv ? `<span style="flex:${cv};background:${C(c).color}" title="${c}: ${eur(cv)}"></span>` : ''; }).join('');
    return `<div class="${now ? 'now' : ''}"><small>${v ? Math.round(v) + ' €' : ''}</small><i style="height:${v / m * 100}%;--j:${j}">${segs}</i>${l}</div>`;
  }).join('')}</div>`;
};
const lastMonths = (ex, n = 6) => [...Array(n)].map((_, i) => { const d = new Date(month); d.setMonth(d.getMonth() - n + 1 + i); return [d.toLocaleDateString('es-ES', { month: 'short' }), ex.filter(e => e.date.startsWith(ym(d))), i === n - 1]; });
const role = attrs => `role="button" tabindex="0" ${attrs}`;

function donut(cats, total) {
  let off = 0;
  const segs = cats.map(([c, v]) => { const p = v / total * 100, s = `<circle r="15.9155" cx="18" cy="18" stroke="${C(c).color}" stroke-dasharray="${Math.max(p - .8, .2)} ${100 - Math.max(p - .8, .2)}" stroke-dashoffset="${-off}"/>`; off += p; return s; }).join('');
  return `<div class="donut"><svg viewBox="0 0 36 36"><circle class="track" r="15.9155" cx="18" cy="18"/>${total ? segs : ''}</svg><div><small>Gastado</small><b data-count="${total}">${eur(total)}</b><small>${monthName(month)}</small></div></div>`;
}

function dashboard(ex, both) {
  const cur = ex.filter(e => e.date.startsWith(ym(month)));
  const gastos = cur.filter(e => e.cat !== 'Inversión');
  const total = sum(gastos), inv = sum(cur.filter(e => e.cat === 'Inversión'));
  const prevM = new Date(month); prevM.setMonth(prevM.getMonth() - 1);
  const prevG = sum(ex.filter(e => e.date.startsWith(ym(prevM)) && e.cat !== 'Inversión'));
  const days = ym(month) === ym(new Date()) ? new Date().getDate() : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const diff = prevG ? Math.round((total - prevG) / prevG * 100) : null;

  const byCat = {};
  gastos.forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + e.amount);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = cats[0]?.[1] || 1;
  const catRows = cats.map(([c, v]) => {
    const bar = both
      ? PEOPLE.map(p => `<span style="width:${sum(gastos.filter(e => e.cat === c && e.userId === p.id)) / max * 100}%;background:${p.color}"></span>`).join('')
      : `<span style="width:${v / max * 100}%;background:${C(c).color}"></span>`;
    return `<div class="row" ${role(`data-open="${c}"`)}>${ic(c)}<div class="l"><div class="t">${c}</div><div class="bar">${bar}</div></div><div style="text-align:right"><b>${eur(v)}</b><br><small>${Math.round(v / total * 100)}%</small></div></div>`;
  }).join('');

  const weeks = {};
  gastos.forEach(e => { const d = new Date(e.date + 'T12:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); (weeks[iso(d)] ||= []).push(e); });
  const wk = Object.entries(weeks).sort().map(([w, es], i, a) => [new Date(w + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), es, i === a.length - 1]);

  const trend = diff !== null ? `<em class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}% vs mes anterior</em>` : '<em class="muted">—</em>';
  const kpis = both
    ? kpi('Gastado entre los dos', total, trend) + PEOPLE.map(p => kpi(p.name, sum(gastos.filter(e => e.userId === p.id)), `<em class="muted">${total ? Math.round(sum(gastos.filter(e => e.userId === p.id)) / total * 100) : 0}% del total</em>`, p.color)).join('') + kpi('Invertido', inv, '', 'var(--inv)')
    : kpi('Gastado', total, trend) + kpi('Media diaria', total / days) + kpi('Invertido', inv, '', 'var(--inv)') + kpi('Mes anterior', prevG);

  // Gastos compartidos: un registro por grupo.
  const shared = both ? Object.values(Object.fromEntries(cur.filter(e => e.group).map(e => [e.group, e]))).sort((a, b) => b.date.localeCompare(a.date)) : [];

  return `<div class="kpis">${kpis}</div>
    <div class="grid">
      <div class="card glass">${donut(cats, total)}</div>
      <div class="card glass"><h3>Categorías${both ? ` · <span class="pdot" style="background:${PEOPLE[0].color}"></span>${PEOPLE[0].name} <span class="pdot" style="background:${PEOPLE[1].color}"></span>${PEOPLE[1].name}` : ''}</h3>${catRows || '<div class="empty">Sin gastos este mes.<br>Escribe abajo, por ejemplo “40 gasolina”.</div>'}</div>
      ${both ? `<div class="card glass wide"><h3>Gastos compartidos este mes · ${eur(sum(shared.map(e => ({ amount: e.total }))))}</h3>${shared.map(e => `<div class="row">${ic(e.cat)}<div class="l"><div class="t">${esc(e.desc)}</div><small>${new Date(e.date + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${eur(e.amount)} cada uno</small></div><b>${eur(e.total)}</b></div>`).join('') || '<div class="empty">Ninguno. Escribe por ejemplo “cena 40 con Álvaro”.</div>'}</div>` : ''}
      <div class="card glass"><h3>Por semana</h3>${wk.length ? vbars(wk) : '<div class="empty">—</div>'}</div>
      <div class="card glass"><h3>Últimos 6 meses</h3>${vbars(lastMonths(ex.filter(e => e.cat !== 'Inversión')))}</div>
    </div>`;
}

function entry(e, both) {
  const others = e.group ? e.with.filter(id => id !== e.userId).map(id => person(id)?.name || '?').join(', ') : '';
  return `<div class="row">${ic(e.cat)}<div class="l"><div class="t">${esc(e.desc)}${e.group ? `<span class="badge">de ${eur(e.total)}</span>` : ''}</div>
    <small>${both ? `<span class="pdot" style="background:${person(e.userId)?.color}"></span>${person(e.userId)?.name} · ` : ''}${new Date(e.date + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}${others ? ' · con ' + esc(others) : ''}</small></div>
    <b>${eur(e.amount)}</b>${e.userId === db.current ? `<button data-del="${e.id}" aria-label="Borrar" style="width:32px;height:32px;min-height:0;padding:0">${svg(I.x)}</button>` : ''}</div>`;
}

// Todo lo registrado en una categoría, agrupado por mes.
function detailView(ex, both) {
  const all = ex.filter(e => e.cat === detail).sort((a, b) => b.date.localeCompare(a.date));
  const now = sum(all.filter(e => e.date.startsWith(ym(month))));
  const monthAll = sum(ex.filter(e => e.date.startsWith(ym(month)) && e.cat !== 'Inversión'));
  const byMonth = {};
  all.forEach(e => (byMonth[e.date.slice(0, 7)] ||= []).push(e));
  return `<div class="dhead"><button data-back aria-label="Volver" style="width:40px;height:40px;padding:0">${svg(I.l)}</button>${ic(detail)}<div><h2>${detail}</h2><small class="muted">${all.length} registros en total</small></div></div>
    <div class="kpis">${kpi('Este mes', now)}<div class="card glass kpi"><small>% del gasto del mes</small><b>${monthAll ? Math.round(now / monthAll * 100) : 0}%</b></div>${kpi('Total histórico', sum(all))}${kpi('Media por gasto', all.length ? sum(all) / all.length : 0)}</div>
    <div class="card glass" style="--c:${C(detail).color}"><h3>Últimos 6 meses</h3>${vbars(lastMonths(all))}</div>
    ${Object.entries(byMonth).map(([m, es]) => `<div class="day"><span>${monthName(new Date(m + '-15'))}</span><b>${eur(sum(es))}</b></div><div class="card glass list">${es.map(e => entry(e, both)).join('')}</div>`).join('') || '<div class="empty">Nada registrado en esta categoría.</div>'}`;
}

function movs(ex, both) {
  const list = ex.filter(e => e.date.startsWith(ym(month))).sort((a, b) => b.date.localeCompare(a.date));
  const days = {};
  list.forEach(e => (days[e.date] ||= []).push(e));
  return Object.entries(days).map(([d, es]) => `<div class="day"><span>${new Date(d + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span>${eur(sum(es))}</span></div>
    <div class="card glass list">${es.map(e => entry(e, both)).join('')}</div>`).join('') || '<div class="empty">Sin movimientos este mes.</div>';
}

function countUp() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, t0 = performance.now();
    const f = t => { const k = Math.min(1, (t - t0) / 800); el.textContent = eur(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
}

function render() {
  const both = tab === 'juntos';
  const key = [tab, detail, ym(month), db.current].join();
  const anim = key !== lastKey; lastKey = key;
  document.body.dataset.theme = both ? 'both' : person(db.current).key;
  $('#people').innerHTML = PEOPLE.map(p => `<button data-me="${p.id}" class="${p.id === db.current ? 'on' : ''}" style="--pc:${p.color}"><span class="av">${p.name[0]}</span>${p.name}</button>`).join('');
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const ex = db.expenses.filter(e => (both ? PEOPLE.map(p => p.id) : [db.current]).includes(e.userId));
  const nav = `<div class="month"><b>${monthName(month)}</b><button data-m="-1" aria-label="Mes anterior">${svg(I.l)}</button><button data-m="1" aria-label="Mes siguiente">${svg(I.r)}</button></div>`;
  const main = $('#main');
  main.innerHTML = detail ? detailView(ex, both) : nav + (tab === 'movs' ? movs(ex, both) : dashboard(ex, both));
  main.classList.toggle('anim', anim);
  main.querySelectorAll('.card, .day, .dhead').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12)));
  if (anim) countUp();
}

document.addEventListener('click', e => {
  const t = e.target.closest('button, [role=button]');
  if (!t) return;
  const d = t.dataset;
  if (d.cat) { over.cat = d.cat; return sheet(); }
  if (d.split) {
    const s = draft().split;
    over.split = s.includes(d.split) ? (s.length > 1 ? s.filter(x => x !== d.split) : s) : [...s, d.split];
    return sheet();
  }
  if ('cancel' in d) return cancel();
  if (d.quick) { const q = $('#sheet').quick[d.quick]; return commit({ amount: q.amount, cat: q.cat, desc: q.desc, date: iso(new Date()), split: [db.current] }); }
  if (d.tab) { tab = d.tab; detail = null; }
  else if (d.me) { db.current = d.me; over = {}; save(); sheet(); if (tab === 'juntos') tab = 'resumen'; }
  else if (d.m) month.setMonth(month.getMonth() + +d.m);
  else if (d.open) { detail = d.open; scrollTo({ top: 0, behavior: 'smooth' }); }
  else if ('back' in d) detail = null;
  else if (d.del) { db.expenses = db.expenses.filter(x => x.id !== d.del); save(); sheet(); }
  else return;
  render();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[role=button]')) e.target.click(); });
const cancel = () => { $('#q').value = ''; over = {}; $('#q').blur(); sheet(); };
$('#q').onkeydown = e => { if (e.key === 'Escape') cancel(); };
$('#q').oninput =() => { if (!$('#q').value.trim()) over = {}; sheet(); }; // lo elegido a mano se mantiene mientras escribes
$('#sheet').onchange = e => { if (e.target.id === 'pd') over.date = e.target.value; };
$('#add').onsubmit = e => { e.preventDefault(); if ($('#q').value.trim()) commit(draft()); };

// Voz: API nativa de Chrome/Edge/Safari. Firefox no la tiene -> se oculta el botón.
$('#mic').innerHTML = svg(I.mic);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) $('#mic').style.display = 'none';
else $('#mic').onclick = () => {
  const r = new SR(); r.lang = 'es-ES';
  r.onresult = ev => {
    $('#q').value = ev.results[0][0].transcript; over = {};
    const p = draft();
    if (p.amount) commit(p, true); else { sheet(); toast('Falta el importe'); }
  };
  r.onerror = ev => toast('Micrófono: ' + ev.error);
  r.onend = () => $('#mic').classList.remove('on');
  $('#mic').classList.add('on'); r.start();
};

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
render(); sheet();
