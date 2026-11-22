// ===== Configuración (datos públicos: la seguridad la ponen el login y las reglas RLS de Supabase) =====
const SUPABASE_URL = 'https://odfwalzmhqhjownxiwvb.supabase.co'; // Project URL
const SUPABASE_KEY = 'sb_publishable_kYuGpuCyqhEgkPTy99GYnw_CbFEZdAo';
// UID de cada uno: Supabase → Authentication → Users → columna UID.
const PEOPLE = [
  { key: 'carmen', name: 'Carmen', color: '#ff2d55', id: '07b48804-59ef-4eb1-abbe-181100bd2c5a' },
  { key: 'alvaro', name: 'Álvaro', color: '#0a84ff', id: '224c11aa-8fba-424a-8607-eb3fd9dbd336' },
];
// =====================================================================================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// Copia local solo como caché para abrir rápido; la verdad está en Supabase.
const CACHE = 'gastos-cache';
const db = { expenses: [] };
try { db.expenses = JSON.parse(localStorage.getItem(CACHE)) || []; } catch {}
const save = () => { try { localStorage.setItem(CACHE, JSON.stringify(db.expenses)); } catch {} };
let me = null, viewing = null; // me = quien ha iniciado sesión; viewing = de quién es el resumen que se ve

const toRow = e => ({ id: e.id, user_id: e.userId, amount: e.amount, cat: e.cat, descr: e.desc, date: e.date, grp: e.group || null, total: e.total || null, with_ids: e.with || null, ...(e.paidBy && { paid_by: e.paidBy }) });
const fromRow = r => ({ id: r.id, userId: r.user_id, amount: +r.amount, cat: r.cat, desc: r.descr || r.cat, date: r.date, ...(r.grp && { group: r.grp, total: +r.total, with: r.with_ids, paidBy: r.paid_by }) });
// Quien añade un gasto compartido es quien lo ha pagado.
const paid = e => e.paidBy && person(e.paidBy) ? ` · <span class="pdot" style="background:${person(e.paidBy).color}"></span>pagó ${person(e.paidBy).name}` : '';

async function load() {
  const all = [];
  for (let from = 0; ; from += 1000) { // Supabase devuelve como mucho 1000 filas por consulta
    const { data, error } = await sb.from('expenses').select('*').range(from, from + 999);
    if (error) return toast('Sin conexión: mostrando datos guardados');
    all.push(...data);
    if (data.length < 1000) break;
  }
  db.expenses = all.map(fromRow); save(); render(); sheet();
}

// Aplica el cambio en pantalla al momento y lo deshace si Supabase falla.
// shortcut: sin conexión no se guarda (avisa); cola offline si hiciera falta.
async function remote(op, rollback) {
  const { error } = await op;
  if (error) { rollback(); save(); render(); toast('No se pudo guardar: ' + error.message); }
}

// Una sola vez: sube los gastos de la versión anterior guardados en este navegador.
async function importOld() {
  let old; try { old = JSON.parse(localStorage.getItem('gastos-v1')); } catch {}
  if (!old?.expenses?.length) return;
  localStorage.setItem('gastos-v1-local', localStorage.getItem('gastos-v1')); localStorage.removeItem('gastos-v1');
  if (!confirm(`¿Subir ${old.expenses.length} gastos guardados antes en este dispositivo?`)) return;
  const idOf = {};
  old.users.forEach(u => idOf[u.id] = PEOPLE.find(p => p.key === norm(u.name))?.id);
  const fix = c => (c === 'Deporte' || c === 'Salud y cuidado') ? 'Deporte y salud' : c;
  const rows = old.expenses.filter(e => idOf[e.userId]).map(e => toRow({ ...e, cat: fix(e.cat), userId: idOf[e.userId], with: e.with?.map(id => idOf[id]).filter(Boolean) }));
  const { error } = await sb.from('expenses').insert(rows);
  if (error) return toast('Error al importar: ' + error.message);
  toast(`${rows.length} gastos importados`); load();
}

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const eur = n => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const person = id => PEOPLE.find(p => p.id === id);
const ym = d => iso(d).slice(0, 7);
const C = c => CATS[c] || CATS.Otros;
const sum = a => a.reduce((s, e) => s + e.amount, 0);
const mine = () => db.expenses.filter(e => e.userId === me);
const svg = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const ic = c => `<span class="ic" style="--c:${C(c).color}">${svg(C(c).p)}</span>`;
const I = { mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3', l: 'M15 18l-6-6 6-6', r: 'M9 18l6-6-6-6', x: 'M6 6l12 12M18 6L6 18', users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' };
const monthName = d => d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

let tab = 'resumen', detail = null, over = {}, lastKey = '', editing = null;
const month = new Date(); month.setDate(1);

// Personas cuyo nombre aparece en el texto -> gasto compartido.
function detectSplit(text) {
  const n = norm(text);
  return [me, ...PEOPLE.filter(p => p.id !== me && new RegExp(`\\b${p.key}\\b`).test(n)).map(p => p.id)];
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
  // Al editar se reutilizan las filas existentes (mismo id) y se quitan las de quien ya no participa.
  const old = editing ? db.expenses.filter(x => editing.group ? x.group === editing.group : x === editing) : [];
  const group = p.split.length > 1 ? (editing?.group || uid()) : null;
  const added = p.split.map(userId => ({ id: old.find(o => o.userId === userId)?.id || uid(), userId, amount: share, cat: p.cat, desc: p.desc || p.cat, date: p.date, ...(group && { group, total: p.amount, with: p.split, paidBy: editing ? old[0]?.paidBy : me }) }));
  const removed = old.filter(o => !p.split.includes(o.userId));
  const drop = () => db.expenses = db.expenses.filter(x => !added.includes(x)).concat(old);
  db.expenses = db.expenses.filter(x => !old.includes(x)).concat(added); save();
  const wasEdit = !!editing;
  closeDock(); render();
  if (wasEdit) {
    // Primero se guarda lo nuevo y solo después se borra lo sobrante: si algo falla no se pierde nada.
    remote(sb.from('expenses').upsert(added.map(toRow)).then(r => r.error || !removed.length ? r : sb.from('expenses').delete().in('id', removed.map(x => x.id))), drop);
    return toast('Gasto actualizado');
  }
  remote(sb.from('expenses').insert(added.map(toRow)), drop);
  toast(`${voice ? 'Dictado · ' : ''}${eur(p.amount)} · ${p.cat}${group ? ' · compartido' : ''}`, () => {
    drop(); save(); render();
    remote(sb.from('expenses').delete().in('id', added.map(x => x.id)), () => db.expenses.push(...added));
  });
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
    <div class="draft">${editing ? '<span class="badge" style="margin:0">Editando</span>' : ''}<b>${p.amount ? eur(p.amount) : '— €'}</b><span class="muted">${esc(p.desc)}</span></div>
    <div class="cats">${Object.keys(CATS).map(c => `<button type="button" data-cat="${c}" class="${c === p.cat ? 'on' : ''}" style="--c:${CATS[c].color}">${svg(CATS[c].p)}<small>${CATS[c].s}</small></button>`).join('')}</div>
    <div class="chips"><button type="button" disabled aria-label="Compartir con">${svg(I.users)}</button>${PEOPLE.map(u => `<button type="button" data-split="${u.id}" class="${p.split.includes(u.id) ? 'on' : ''}" style="--pc:${u.color}">${u.name}</button>`).join('')}</div>
    <div class="opts"><input type="date" id="pd" value="${p.date}" aria-label="Fecha">
      ${p.split.length > 1 && p.amount ? `<small class="muted">${eur(p.amount / p.split.length)} c/u</small>` : ''}
      <button type="button" data-cancel style="margin-left:auto">Cancelar</button>
      <button class="pri" type="submit" form="add" style="margin-left:0">${editing ? 'Guardar cambios' : 'Guardar'}</button></div>`;
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
    const bar = `<span style="width:${v / max * 100}%;background:${C(c).color}"></span>`;
    return `<div class="row" ${role(`data-open="${c}"`)}>${ic(c)}<div class="l"><div class="t">${c}</div><div class="bar">${bar}</div></div><div style="text-align:right"><b>${eur(v)}</b><br><small>${Math.round(v / total * 100)}%</small></div></div>`;
  }).join('');

  const weeks = {};
  gastos.forEach(e => { const d = new Date(e.date + 'T12:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); (weeks[iso(d)] ||= []).push(e); });
  const wk = Object.entries(weeks).sort().map(([w, es], i, a) => [new Date(w + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), es, i === a.length - 1]);

  const trend = diff !== null ? `<em class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}% vs mes anterior</em>` : '<em class="muted">—</em>';
  const kpis = both
    ? kpi('Gastado juntos', total, trend) + kpi('Media diaria', total / days) + kpi('Por persona', total / PEOPLE.length) + kpi('Mes anterior', prevG)
    : kpi('Gastado', total, trend) + kpi('Media diaria', total / days) + kpi('Invertido', inv, '', 'var(--inv)') + kpi('Mes anterior', prevG);
  const shared = both ? [...cur].sort((a, b) => b.date.localeCompare(a.date)) : [];

  return `<div class="kpis">${kpis}</div>
    <div class="grid">
      <div class="card glass">${donut(cats, total)}</div>
      <div class="card glass"><h3>Categorías</h3>${catRows || `<div class="empty">Sin gastos ${both ? 'compartidos' : ''} este mes.<br>Escribe abajo, por ejemplo “${both ? 'cena 40 con Álvaro' : '40 gasolina'}”.</div>`}</div>
      ${both && shared.length ? `<div class="card glass wide"><h3>Gastos compartidos este mes</h3>${shared.map(e => `<div class="row">${ic(e.cat)}<div class="l"><div class="t">${esc(e.desc)}</div><small>${new Date(e.date + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${eur(e.total / e.with.length)} cada uno${paid(e)}</small></div><b>${eur(e.total)}</b></div>`).join('')}</div>` : ''}
      <div class="card glass"><h3>Por semana</h3>${wk.length ? vbars(wk) : '<div class="empty">—</div>'}</div>
      <div class="card glass"><h3>Últimos 6 meses</h3>${vbars(lastMonths(ex.filter(e => e.cat !== 'Inversión')))}</div>
    </div>`;
}

function entry(e, both) {
  const others = e.group ? e.with.filter(id => id !== e.userId).map(id => person(id)?.name || '?').join(', ') : '';
  return `<div class="row" ${e.userId === me ? role(`data-edit="${e.id}" title="Editar"`) : ''}>${ic(e.cat)}<div class="l"><div class="t">${esc(e.desc)}${e.group && !both ? `<span class="badge">de ${eur(e.total)}</span>` : ''}</div>
    <small>${new Date(e.date + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}${both ? ` · ${eur(e.total / e.with.length)} cada uno` : others ? ' · con ' + esc(others) : ''}${paid(e)}</small></div>
    <b>${eur(e.amount)}</b>${e.userId === me ? `<button data-del="${e.id}" aria-label="Borrar" style="width:32px;height:32px;min-height:0;padding:0">${svg(I.x)}</button>` : ''}</div>`;
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
  const logged = !!me;
  for (const s of ['#dock', '#fab', 'nav', '#people']) $(s).style.display = logged ? '' : 'none';
  if (!logged) {
    lastKey = '';
    $('#main').innerHTML = `<form id="login" class="card glass" style="max-width:380px;margin:60px auto;display:grid;gap:10px">
      <h2 style="margin:0">Hola 👋</h2><small class="muted">Inicia sesión para ver vuestros gastos.</small>
      <input id="le" type="email" placeholder="Email" autocomplete="email" required style="border:0;background:var(--chip);border-radius:14px;padding:12px">
      <input id="lp" type="password" placeholder="Contraseña" autocomplete="current-password" required style="border:0;background:var(--chip);border-radius:14px;padding:12px">
      <button class="pri">Entrar</button></form>`;
    $('#login').onsubmit = async ev => {
      ev.preventDefault();
      const { data, error } = await sb.auth.signInWithPassword({ email: $('#le').value.trim(), password: $('#lp').value });
      if (error) return toast('Email o contraseña incorrectos');
      start(data.session);
    };
    return;
  }
  const both = tab === 'juntos';
  const key = [tab, detail, ym(month), viewing].join();
  const anim = key !== lastKey; lastKey = key;
  document.body.dataset.theme = both ? 'both' : person(viewing).key;
  $('#people').innerHTML = PEOPLE.map(p => `<button data-me="${p.id}" class="${p.id === viewing ? 'on' : ''}" style="--pc:${p.color}"><span class="av">${p.name[0]}</span>${p.name}</button>`).join('')
    + `<button data-logout title="Cerrar sesión" style="font-size:13px">Salir</button>`;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  // Juntos: solo gastos compartidos, uno por grupo y con su importe total. Usuario: solo los suyos.
  const ex = both
    ? Object.values(Object.fromEntries(db.expenses.filter(e => e.group).map(e => [e.group, { ...e, amount: e.total, userId: null }])))
    : db.expenses.filter(e => e.userId === viewing);
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
  if ('cancel' in d) return closeDock();
  if ('add' in d) return openDock();
  if (d.edit) return openDock(db.expenses.find(x => x.id === d.edit));
  if (d.quick) { const q = $('#sheet').quick[d.quick]; return commit({ amount: q.amount, cat: q.cat, desc: q.desc, date: iso(new Date()), split: [me] }); }
  if ('logout' in d) { sb.auth.signOut(); me = viewing = null; db.expenses = []; save(); }
  else if (d.tab) { tab = d.tab; detail = null; }
  else if (d.me) { viewing = d.me; if (tab === 'juntos') tab = 'resumen'; }
  else if (d.m) month.setMonth(month.getMonth() + +d.m);
  else if (d.open) { detail = d.open; scrollTo({ top: 0, behavior: 'smooth' }); }
  else if ('back' in d) detail = null;
  else if (d.del) {
    const gone = db.expenses.find(x => x.id === d.del);
    db.expenses = db.expenses.filter(x => x !== gone); save(); sheet();
    remote(sb.from('expenses').delete().eq('id', d.del), () => db.expenses.push(gone));
  }
  else return;
  render();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[role=button]')) e.target.click(); });
// El panel de entrada se abre con el botón + o al tocar un gasto propio (para editarlo).
function openDock(e) {
  editing = e || null;
  if (e) {
    // Importe primero para que un número dentro del concepto ("2 cañas") no se tome como importe.
    $('#q').value = `${String(e.total || e.amount).replace('.', ',')} ${e.desc}`;
    over = { cat: e.cat, date: e.date, split: e.with || [e.userId] };
  }
  $('#dock').classList.add('open'); sheet(); $('#q').focus();
}
function closeDock() { $('#q').value = ''; over = {}; editing = null; $('#q').blur(); $('#dock').classList.remove('open'); sheet(); }
$('#q').onkeydown = e => { if (e.key === 'Escape') closeDock(); };
$('#close').innerHTML = svg(I.x);
$('#fab').innerHTML = svg('M12 5v14M5 12h14');
$('#q').oninput =() => { if (!$('#q').value.trim() && !editing) over = {}; sheet(); }; // lo elegido a mano se mantiene mientras escribes
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

function start(session) {
  if (!session) { me = null; return render(); }
  if (!person(session.user.id)) { sb.auth.signOut(); me = null; render(); return toast('Este usuario no está en PEOPLE (app.js)'); }
  me = viewing = session.user.id;
  render(); sheet(); load(); importOld();
}
// Al volver a la app, trae lo que haya añadido la otra persona.
document.addEventListener('visibilitychange', () => { if (!document.hidden && me) load(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
sb.auth.getSession().then(({ data }) => start(data.session));
