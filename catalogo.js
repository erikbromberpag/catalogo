(() => {
'use strict';

/* =====================================================================
   PÁGINA Y DATOS
   La configuración está en config.js y los productos en productos.json.
   ===================================================================== */
const CONFIG = window.CONFIG;
const PAGINA = document.body.dataset.pagina === 'pedido' ? 'pedido' : 'propio';
const PAG = CONFIG.PAGINAS[PAGINA];
let RUBROS = [], PRODUCTOS = [], IMGS = {};
const stockDe = p => p.stock === 'propio' ? 'propio' : 'pedido'; // sin dato = a pedido

/* =====================================================================
   UTILIDADES
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const TC = Number(CONFIG.TIPO_CAMBIO) > 0 ? Number(CONFIG.TIPO_CAMBIO) : 0;
const VIS = TC && Number(CONFIG.DOLAR_MOSTRADO) > 0 ? Number(CONFIG.DOLAR_MOSTRADO) : TC; // dólar con el que se muestran los US$
const RECARGO = Math.max(0, Number(CONFIG.RECARGO_MP) || 0) / 100;
const r2 = v => Math.round(v * 100) / 100;
const pad = n => String(n).padStart(3, '0');
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function num(v, dec) { const [i, f] = v.toFixed(dec).split('.'); const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return f ? g + ',' + f : g; }
const dec = (v, cur) => cur === 'USD' || !Number.isInteger(v) ? 2 : 0;
function money(v, cur) { return (cur === 'USD' ? 'US$ ' : '$ ') + num(v, dec(v, cur)); }

const BY_N = new Map(); // solo los productos de esta página

/* ---------- estado ---------- */
const state = { q: '', rubro: -1, moneda: CONFIG.MONEDA_INICIAL === 'USD' ? 'USD' : 'ARS', cart: {} };
const CLAVE = CONFIG.CLAVE_GUARDADO + '-' + PAGINA; // cada página guarda su propio carrito
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    if (saved && typeof saved === 'object') {
      if (saved.cart) for (const k in saved.cart) { const q = parseInt(saved.cart[k], 10); if (BY_N.has(+k) && q > 0) state.cart[k] = ajustarQty(BY_N.get(+k), Math.min(q, 9999)); }
      if (saved.cliente) $('#cliente').value = String(saved.cliente).slice(0, 80);
      if (saved.notas) $('#notas').value = String(saved.notas).slice(0, 500);
    }
  } catch (e) { /* sin almacenamiento: el carrito vive solo en esta visita */ }
}
function persist() {
  try { localStorage.setItem(CLAVE, JSON.stringify({ cart: state.cart, cliente: $('#cliente').value, notas: $('#notas').value })); } catch (e) {}
}

/* ---------- precios por cantidad (los niveles se configuran en CONFIG.NIVELES) ---------- */
// Precio de lista en pesos; null si está en dólares y no hay tipo de cambio.
function listaARS(p) { return p.c === 'ARS' ? p.p : TC ? Math.round(p.p * TC) : null; }
// Unidades del pack de los productos baratos sin descuento; 0 si el producto tiene niveles.
function packDe(p) {
  const ars = listaARS(p);
  if (ars === null || !(ars < Number(CONFIG.SIN_DESCUENTO_MENOR_A))) return 0;
  return Number(CONFIG.PACKS[p.n]) || Number(CONFIG.PACK_SIN_DESCUENTO) || 1;
}
const paso = p => packDe(p) || 1;
function ajustarQty(p, q) { const k = paso(p); return Math.min(9999 - 9999 % k, Math.ceil(q / k) * k); }
// Niveles del producto con sus unidades mínimas, de menor a mayor.
function escalera(p) {
  if (packDe(p)) return [];
  return CONFIG.NIVELES.map(nv => ({
    nombre: nv.nombre, desc: Number(nv.descuento) || 0, caja: nv.desde === 'bulto',
    desde: nv.desde === 'bulto' ? Math.max(p.b || 0, CONFIG.CAJA_MINIMA) : nv.desde
  })).sort((a, b) => a.desde - b.desde);
}
function nivelDe(p, q) { let lv = null; for (const nv of escalera(p)) if (q >= nv.desde) lv = nv; return lv; }
// Monto en pesos en la moneda elegida (los US$ se muestran al DOLAR_MOSTRADO; los pesos no cambian).
const verARS = v => state.moneda === 'USD' ? { v: r2(v / VIS), cur: 'USD' } : { v, cur: 'ARS' };
function precioCon(p, desc) {
  if (TC) return verARS(Math.round(listaARS(p) * (1 - desc / 100)));
  const v = p.p * (1 - desc / 100); // sin tipo de cambio: cada producto en su moneda
  return { v: p.c === 'USD' ? r2(v) : Math.round(v), cur: p.c };
}
const unit = p => precioCon(p, 0);
// Todo lo de un renglón del pedido: nivel, precio unitario, subtotal y ahorro.
function linea(p, q) {
  const lv = nivelDe(p, q), d = lv ? lv.desc : 0, lista = unit(p), u = precioCon(p, d);
  const ars = TC ? Math.round(listaARS(p) * (1 - d / 100)) * q : p.c === 'ARS' ? u.v * q : 0;
  return { q, lv, lista, u, cur: u.cur, sub: r2(u.v * q), ahorro: r2((lista.v - u.v) * q), ars,
    nivel: lv ? lv.nombre + (d ? ' −' + d + '%' : '') : 'Pack de ' + packDe(p) + ' u.' };
}
// Próximo nivel: cuántas unidades más y a qué precio.
function proximo(p, q) {
  const nv = escalera(p).find(x => x.desde > q && x.desc > 0); if (!nv || !q) return null;
  if (nv.desde - q > Math.max(3, q)) return null; // no empujar a una caja muy lejana
  return { faltan: nv.desde - q, nv, u: precioCon(p, nv.desc) };
}
function totals() {
  const t = { USD: 0, ARS: 0 }, a = { USD: 0, ARS: 0 }; let lines = 0, units = 0, ars = 0;
  for (const k in state.cart) {
    const L = linea(BY_N.get(+k), state.cart[k]);
    t[L.cur] = r2(t[L.cur] + L.sub); a[L.cur] = r2(a[L.cur] + L.ahorro); ars += L.ars; lines++; units += L.q;
  }
  const mp = { ARS: Math.round(t.ARS * (1 + RECARGO)), USD: r2(t.USD * (1 + RECARGO)) };
  const minimo = Number(CONFIG.PEDIDO_MINIMO) || 0, envio = Number(CONFIG.ENVIO_GRATIS_DESDE) || 0;
  return { t, a, mp, lines, units, ars, faltaMin: Math.max(0, minimo - ars), faltaEnvio: envio ? Math.max(0, envio - ars) : null };
}
const pesos = v => TC ? (x => money(x.v, x.cur))(verARS(v)) : money(v, 'ARS');
const hayAhorro = a => a.ARS > 0 || a.USD > 0;
function avisos(tot) {
  const out = [];
  if (tot.faltaMin > 0) out.push({ tipo: 'min', txt: `Te faltan ${pesos(tot.faltaMin)} para el pedido mínimo de ${pesos(CONFIG.PEDIDO_MINIMO)}.` });
  else if (tot.faltaEnvio !== null) out.push(tot.faltaEnvio > 0
    ? { tipo: 'envio', txt: `Te faltan ${pesos(tot.faltaEnvio)} para el envío gratis (desde ${pesos(CONFIG.ENVIO_GRATIS_DESDE)}).` }
    : { tipo: 'ok', txt: 'Tu pedido tiene envío gratis.' });
  if (PAG.AVISO) out.push({ tipo: 'pago', txt: PAG.AVISO });
  return out;
}
function totalParts(t) {
  const parts = ['ARS', 'USD'].filter(c => t[c] > 0).map(c => money(Math.round(t[c] * 100) / 100, c));
  return parts.length ? parts : [money(0, TC ? state.moneda : 'ARS')];
}
const totalText = t => totalParts(t).join(' + ');
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

/* =====================================================================
   RENDER DEL CATÁLOGO
   ===================================================================== */
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting && loadImg(e.target)) io.unobserve(e.target); });
}, { rootMargin: '600px 0px' }) : null;
// Las fotos llegan aparte (imagenes.json): si todavía no están, la imagen queda observada y se carga cuando llegan.
function loadImg(img) { const d = IMGS[img.dataset.n]; if (d) img.src = 'data:image/webp;base64,' + d; return !!d; }
function loadPendingImgs() {
  document.querySelectorAll('#list img[data-n]:not([src])').forEach(img => { if (io) { io.unobserve(img); io.observe(img); } else loadImg(img); });
  document.querySelectorAll('#lines img[data-n]').forEach(loadImg);
}

// Escalera de precios de la ficha ("6+ $X"), con el nivel actual marcado.
function tiersHTML(p, q) {
  const pk = packDe(p);
  if (pk) return `Se vende en packs de ${pk} u. · sin descuento por cantidad`;
  const lv = nivelDe(p, q);
  return escalera(p).filter(nv => nv.desc > 0).map(nv => {
    const u = precioCon(p, nv.desc);
    return `<span${lv && lv.desde === nv.desde ? ' class="on"' : ''}>${nv.caja ? 'Caja ' + num(nv.desde, 0) : nv.desde + '+'} <b>${money(u.v, u.cur)}</b></span>`;
  }).join('');
}
function subHTML(p, q) {
  if (!q) return '';
  const L = linea(p, q), nx = proximo(p, q);
  let h = `Subtotal ${money(L.sub, L.cur)}<span class="lvl">${esc(L.nivel)}${L.ahorro > 0 ? ' · ahorrás ' + money(L.ahorro, L.cur) : ''}</span>`;
  if (nx) h += `<span class="next">Sumá ${plural(nx.faltan, 'unidad', 'unidades')} y pagás ${money(nx.u.v, nx.u.cur)} c/u</span>`;
  return h;
}

function cardHTML(p) {
  const q = state.cart[p.n] || 0, u = unit(p), c = pad(p.n), que = packDe(p) ? 'un pack' : 'una unidad';
  return `<article class="card${q ? ' on' : ''}" data-n="${p.n}">
  <div class="pic"><span class="code">${c}</span><img alt="${esc(p.t)}" data-n="${p.n}" width="260" height="195"></div>
  <div class="body">
    <h3 class="name">${esc(p.t)}</h3>
    ${p.d ? `<p class="desc">${esc(p.d)}</p>` : ''}
    ${p.m ? `<p class="mod">Modelo ${esc(p.m)}</p>` : ''}
    ${p.b ? `<p class="bulto">Bulto: ${num(p.b, 0)} ${p.b === 1 ? 'unidad' : 'u.'}</p>` : ''}
    <div class="buy">
      <div class="price"><small>${u.cur === 'USD' ? 'US$' : '$'}</small>${num(u.v, dec(u.v, u.cur))}</div>
      <p class="tiers" data-tiers>${tiersHTML(p, q)}</p>
      <div class="sub" data-sub>${subHTML(p, q)}</div>
      <div class="qty">
        <button type="button" class="qm" aria-label="Quitar ${que} del producto ${c}">−</button>
        <input type="number" inputmode="numeric" min="0" max="9999" step="${paso(p)}" value="${q}" aria-label="Cantidad del producto ${c}">
        <button type="button" class="qp" aria-label="Agregar ${que} del producto ${c}">+</button>
      </div>
    </div>
  </div>
</article>`;
}

const tokens = () => norm(state.q).split(/\s+/).filter(Boolean);
const coincide = (p, toks) => toks.every(t => p.h.includes(t) || (/^\d{1,3}$/.test(t) && +t === p.n));
function visible() {
  const toks = tokens();
  return PRODUCTOS.filter(p => (state.rubro < 0 || p.r === state.rubro) && coincide(p, toks));
}
function render() {
  const list = visible(), host = $('#list');
  if (!list.length) {
    host.innerHTML = `<div class="empty"><strong>No encontramos productos${state.q ? ' para “' + esc(state.q) + '”' : ''}</strong>Revisá la ortografía, probá con una sola palabra o buscá por número.<br><button type="button" id="resetFilters">Ver todos los productos de ${esc(PAG.TITULO)}</button></div>`;
    return;
  }
  const groups = new Map();
  list.forEach(p => { if (!groups.has(p.r)) groups.set(p.r, []); groups.get(p.r).push(p); });
  let html = '';
  [...groups.keys()].sort((a, b) => a - b).forEach(r => {
    const ps = groups.get(r);
    html += `<section class="rubro" id="rubro-${r}" aria-labelledby="h-${r}"><h2 id="h-${r}">${esc(RUBROS[r])}<small>${plural(ps.length, 'producto', 'productos')}</small></h2><div class="grid">${ps.map(cardHTML).join('')}</div></section>`;
  });
  host.innerHTML = html;
  host.querySelectorAll('img[data-n]').forEach(img => io ? io.observe(img) : loadImg(img));
}

function renderChips() {
  const counts = RUBROS.map((_, i) => PRODUCTOS.filter(p => p.r === i).length);
  $('#chips').innerHTML = `<button type="button" class="chip" data-r="-1" aria-pressed="true">Todo<span>${PRODUCTOS.length}</span></button>` +
    RUBROS.map((r, i) => counts[i] ? `<button type="button" class="chip" data-r="${i}" aria-pressed="false">${esc(r)}<span>${counts[i]}</span></button>` : '').join('');
}
function syncChips() { document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.r === state.rubro))); }

/* =====================================================================
   CARRITO
   ===================================================================== */
function setQty(n, q, from) {
  const p = BY_N.get(n);
  q = Math.max(0, Math.min(9999, Math.floor(Number(q)) || 0));
  if (q) q = ajustarQty(p, q); // los productos sin descuento van de a packs
  if (q) state.cart[n] = q; else delete state.cart[n];
  persist();
  const card = $(`.card[data-n="${n}"]`);
  if (card) {
    card.classList.toggle('on', q > 0);
    const inp = $('input', card); if (inp !== from && document.activeElement !== inp) inp.value = q;
    $('[data-sub]', card).innerHTML = subHTML(p, q); $('[data-tiers]', card).innerHTML = tiersHTML(p, q);
  }
  updateBar();
  if (!$('#sheet').hidden) renderCart();
}

function updateBar() {
  const tot = totals(), { t, lines, units } = tot, bar = $('#bar');
  document.body.classList.toggle('has-bar', lines > 0);
  bar.hidden = lines === 0;
  $('#barTotal').textContent = totalText(t);
  $('#barCount').textContent = plural(lines, 'producto', 'productos') + ' · ' + plural(units, 'unidad', 'unidades') +
    (tot.faltaMin > 0 ? ' · faltan ' + pesos(tot.faltaMin) + ' para el mínimo' : '');
}

function renderCart(focusSel) {
  const keys = Object.keys(state.cart).map(Number).sort((a, b) => BY_N.get(a).r - BY_N.get(b).r || a - b);
  const box = $('#lines');
  if (!keys.length) {
    box.innerHTML = '<div class="empty-cart"><strong>Tu carrito está vacío</strong><br>Elegí cantidades en el catálogo y volvé acá para enviar el pedido.</div>';
    $('#sheetF').hidden = true; $('#extras').hidden = true; return;
  }
  $('#sheetF').hidden = false; $('#extras').hidden = false;
  box.innerHTML = keys.map(n => {
    const p = BY_N.get(n), q = state.cart[n], L = linea(p, q), c = pad(n), nx = proximo(p, q), que = packDe(p) ? 'un pack' : 'una unidad';
    return `<div class="line" data-n="${n}">
      <img alt="" data-n="${n}" src="data:image/webp;base64,${IMGS[n] || ''}">
      <div><p class="l-name"><b>${c}</b>${esc(p.t)}</p>
        <p class="l-unit">${L.ahorro > 0 ? `<s>${money(L.lista.v, L.cur)}</s> ` : ''}${money(L.u.v, L.cur)} c/u · <span class="lvl">${esc(L.nivel)}</span></p>
        ${L.ahorro > 0 ? `<p class="l-save">Ahorrás ${money(L.ahorro, L.cur)}</p>` : ''}
        ${nx ? `<p class="l-next">Sumá ${plural(nx.faltan, 'unidad', 'unidades')} y pagás ${money(nx.u.v, nx.u.cur)} c/u</p>` : ''}</div>
      <div class="l-right">
        <div class="l-sub">${money(L.sub, L.cur)}</div>
        <div class="qty"><button type="button" class="qm" aria-label="Quitar ${que} del producto ${c}">−</button><input type="number" inputmode="numeric" min="0" max="9999" step="${paso(p)}" value="${q}" aria-label="Cantidad del producto ${c}"><button type="button" class="qp" aria-label="Agregar ${que} del producto ${c}">+</button></div>
        <button type="button" class="rm" data-rm="${n}">Quitar</button>
      </div></div>`;
  }).join('');
  const tot = totals(), { t, a, mp, lines, units } = tot;
  $('#avisos').innerHTML = avisos(tot).map(x => `<p class="aviso aviso-${x.tipo}">${esc(x.txt)}</p>`).join('');
  $('#sumTotal').innerHTML = totalParts(t).map(x => '<span>' + esc(x) + '</span>').join('');
  $('#sumCount').innerHTML = esc(plural(lines, 'producto', 'productos') + ' · ' + plural(units, 'unidad', 'unidades')) +
    '<br>Total por transferencia' + (hayAhorro(a) ? `<br><em>Ahorrás ${esc(totalText(a))}</em>` : '');
  $('#sumMP').textContent = RECARGO ? `Con Mercado Pago (+${num(RECARGO * 100, 0)}%): ${totalText(mp)}` : '';
  if (focusSel) { const el = $(focusSel); if (el) el.focus(); }
}

let lastFocus = null;
function openCart() { lastFocus = document.activeElement; renderCart(); $('#sheet').hidden = false; $('#shade').hidden = false; document.body.style.overflow = 'hidden'; $('#closeCart').focus(); }
function closeCart() { $('#sheet').hidden = true; $('#shade').hidden = true; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

/* =====================================================================
   MENSAJE DE WHATSAPP
   ===================================================================== */
function buildMessage() {
  const keys = Object.keys(state.cart).map(Number).sort((a, b) => BY_N.get(a).r - BY_N.get(b).r || a - b);
  const tot = totals(), { t, a, mp, lines, units } = tot;
  const cliente = $('#cliente').value.trim(), notas = $('#notas').value.trim();
  const f = new Date(), fecha = String(f.getDate()).padStart(2, '0') + '/' + String(f.getMonth() + 1).padStart(2, '0') + '/' + f.getFullYear();
  const out = [CONFIG.SALUDO, '', '*PEDIDO · ' + CONFIG.NEGOCIO + '*', '*' + PAG.TITULO + '*', 'Fecha: ' + fecha];
  if (cliente) out.push('Cliente: ' + cliente);
  let rub = -1;
  keys.forEach(n => {
    const p = BY_N.get(n), q = state.cart[n], L = linea(p, q);
    if (p.r !== rub) { rub = p.r; out.push('', '*' + RUBROS[rub] + '*'); }
    out.push(`${pad(n)} · ${p.t}`, `      ${q} u. × ${money(L.u.v, L.cur)} (${L.nivel}) = ${money(L.sub, L.cur)}` +
      (L.ahorro > 0 ? ` · ahorrás ${money(L.ahorro, L.cur)}` : ''));
  });
  out.push('', '------------------------', `Productos: ${lines} · Unidades: ${units}`);
  if (hayAhorro(a)) out.push('Ahorro por cantidad: ' + totalText(a));
  out.push('*TOTAL transferencia: ' + totalText(t) + '*');
  if (RECARGO) out.push(`Total con Mercado Pago (+${num(RECARGO * 100, 0)}%): ` + totalText(mp));
  if (tot.faltaMin > 0) out.push(`⚠️ No llega al pedido mínimo de ${pesos(CONFIG.PEDIDO_MINIMO)} (faltan ${pesos(tot.faltaMin)})`);
  else if (tot.faltaEnvio !== null) out.push(tot.faltaEnvio > 0 ? `Envío gratis desde ${pesos(CONFIG.ENVIO_GRATIS_DESDE)} (faltan ${pesos(tot.faltaEnvio)})` : 'Envío gratis ✅');
  if (TC && state.moneda === 'USD') out.push('(Precios en dólares · dólar de referencia $ ' + num(VIS, 0) + ')');
  if (PAG.AVISO) out.push('', '*' + PAG.AVISO + '*');
  if (notas) out.push('', 'Notas: ' + notas);
  out.push('', 'Quedo atento a la confirmación de disponibilidad y forma de pago. ¡Gracias!');
  return out.join('\n');
}

let toastTimer;
function toast(msg, ms = 4500) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms); }
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {} ta.remove(); return ok;
  }
}
function sendWhatsApp() {
  if (!Object.keys(state.cart).length) { toast('Agregá al menos un producto para enviar el pedido.'); return; }
  const num_ = String(CONFIG.WHATSAPP).replace(/\D/g, '');
  if (!num_ || num_ === '54911000000') { toast('Falta configurar el número de WhatsApp del negocio (CONFIG.WHATSAPP en el código).', 7000); return; }
  const falta = totals().faltaMin;
  if (falta > 0 && CONFIG.PEDIDO_MINIMO_BLOQUEA) { toast(`El pedido mínimo es de ${pesos(CONFIG.PEDIDO_MINIMO)}. Te faltan ${pesos(falta)}.`, 6000); return; }
  const msg = buildMessage(); persist();
  let url = 'https://wa.me/' + num_ + '?text=' + encodeURIComponent(msg);
  if (url.length > 6500) { // pedido muy largo: WhatsApp puede cortarlo, se copia para pegarlo en el chat
    copyText(msg); url = 'https://wa.me/' + num_;
    toast('El pedido es largo: lo copiamos. Pegalo en el chat de WhatsApp que se abre.', 8000);
  }
  const w = window.open(url, '_blank'); if (!w) location.href = url;
}

/* =====================================================================
   EVENTOS
   ===================================================================== */
function onQtyClick(e, scope) {
  const btn = e.target.closest('.qm,.qp'); if (!btn) return false;
  const holder = btn.closest('[data-n]'), n = +holder.dataset.n, cur = state.cart[n] || 0;
  setQty(n, cur + (btn.classList.contains('qp') ? 1 : -1) * paso(BY_N.get(n)));
  if (scope === 'cart') { const again = $(`.line[data-n="${n}"] .${btn.classList.contains('qp') ? 'qp' : 'qm'}`); if (again) again.focus(); }
  return true;
}
$('#list').addEventListener('click', e => {
  if (e.target.id === 'resetFilters') { state.q = ''; state.rubro = -1; $('#q').value = ''; $('#qclear').hidden = true; syncChips(); render(); return; }
  onQtyClick(e, 'grid');
});
$('#list').addEventListener('input', e => { if (e.target.matches('.card input')) { const n = +e.target.closest('.card').dataset.n, v = e.target.value; if (v !== '') setQty(n, v, e.target); } });
$('#list').addEventListener('change', e => { if (e.target.matches('.card input')) { const n = +e.target.closest('.card').dataset.n; setQty(n, e.target.value === '' ? 0 : e.target.value); e.target.value = state.cart[n] || 0; } });
$('#list').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.card input')) e.target.blur(); });

$('#lines').addEventListener('click', e => {
  if (onQtyClick(e, 'cart')) return;
  const rm = e.target.closest('[data-rm]'); if (rm) setQty(+rm.dataset.rm, 0);
});
$('#lines').addEventListener('change', e => { if (e.target.matches('.line input')) setQty(+e.target.closest('.line').dataset.n, e.target.value); });

$('#chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  state.rubro = +b.dataset.r; syncChips(); render();
  window.scrollTo({ top: Math.max(0, $('main').offsetTop - $('#top').offsetHeight), behavior: 'smooth' });
  b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
});
let tq;
$('#q').addEventListener('input', e => { clearTimeout(tq); $('#qclear').hidden = !e.target.value; tq = setTimeout(() => { state.q = e.target.value; render(); }, 160); });
$('#qclear').addEventListener('click', () => { $('#q').value = ''; state.q = ''; $('#qclear').hidden = true; render(); $('#q').focus(); });

$('#money').addEventListener('click', e => {
  const b = e.target.closest('button[data-m]'); if (!b) return;
  state.moneda = b.dataset.m; document.querySelectorAll('#money button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  setHint(); render(); updateBar(); if (!$('#sheet').hidden) renderCart();
});

$('#openCart').addEventListener('click', openCart);
$('#bar').addEventListener('click', e => { if (e.target === $('#bar') || e.target.closest('.bar-info')) openCart(); });
$('#closeCart').addEventListener('click', closeCart);
$('#shade').addEventListener('click', closeCart);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeCart();
  if (e.key === 'Tab' && !$('#sheet').hidden) { // el foco queda dentro del carrito mientras está abierto
    const f = [...$('#sheet').querySelectorAll('button,input,textarea')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
$('#send').addEventListener('click', sendWhatsApp);
$('#copy').addEventListener('click', async () => {
  if (!Object.keys(state.cart).length) return toast('Todavía no hay productos en el pedido.');
  toast((await copyText(buildMessage())) ? 'Pedido copiado. Pegalo donde quieras.' : 'No se pudo copiar. Probá con el botón de WhatsApp.', 3500);
});
$('#clear').addEventListener('click', () => {
  if (!confirm('¿Vaciar el carrito? Se borran todos los productos elegidos.')) return;
  state.cart = {}; persist();
  document.querySelectorAll('.card.on').forEach(c => { c.classList.remove('on'); $('input', c).value = 0; $('[data-sub]', c).textContent = ''; });
  updateBar(); renderCart();
});
$('#cliente').addEventListener('input', persist); $('#notas').addEventListener('input', persist);

/* =====================================================================
   INICIO
   ===================================================================== */
document.title = CONFIG.NEGOCIO + ' · ' + PAG.TITULO;
// Texto de arriba del catálogo: cómo pedir y los descuentos por cantidad, en dos líneas cortas (más el aviso de la página, si tiene).
const setHint = () => {
  const desc = CONFIG.NIVELES.filter(nv => nv.descuento > 0)
    .map(nv => `<b>${nv.desde === 'bulto' ? 'Caja cerrada' : nv.desde + ' o más'}: −${nv.descuento}%</b>`).join(' · ');
  const reglas = [
    CONFIG.PEDIDO_MINIMO > 0 ? 'Pedido mínimo ' + pesos(CONFIG.PEDIDO_MINIMO) : '',
    CONFIG.ENVIO_GRATIS_DESDE > 0 ? 'Envío gratis desde ' + pesos(CONFIG.ENVIO_GRATIS_DESDE) : '',
    RECARGO ? 'Mercado Pago +' + num(RECARGO * 100, 0) + '%' : ''
  ].filter(Boolean).join(' · ');
  $('#hint').innerHTML = (PAG.AVISO ? `<strong class="hint-aviso">${esc(PAG.AVISO)}</strong>` : '') +
    `<span>Más unidades del mismo producto, mejor precio: ${desc}</span>` +
    (reglas ? `<span>${esc(reglas)}</span>` : '');
};
setHint();
$('#negocio').textContent = CONFIG.NEGOCIO; $('#sub').textContent = [CONFIG.SUBTITULO.trim(), PAG.TITULO].filter(Boolean).join(' · '); $('#foot').textContent = CONFIG.PIE;
if (TC) { $('#money').hidden = false; document.querySelectorAll('#money button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === state.moneda))); }
const setHeadH = () => document.documentElement.style.setProperty('--head-h', $('#top').offsetHeight + 8 + 'px');
addEventListener('resize', setHeadH);
if ('fonts' in document) document.fonts.ready.then(setHeadH);

// Los productos salen de productos.json (el mismo archivo para las dos páginas, cada una muestra solo los suyos); las fotos, de imagenes.json.
$('#list').innerHTML = '<p class="hint">Cargando productos…</p>';
const fotos = fetch('imagenes.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
fetch('productos.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(datos => {
  RUBROS = datos.rubros;
  PRODUCTOS = datos.productos.filter(p => stockDe(p) === PAGINA);
  PRODUCTOS.forEach(p => { p.h = norm([pad(p.n), p.t, p.d || '', p.m || '', RUBROS[p.r]].join(' ')); });
  PRODUCTOS.forEach(p => BY_N.set(p.n, p));
  restore(); renderChips(); render(); updateBar(); setHeadH();
  fotos.then(d => { IMGS = d || {}; loadPendingImgs(); });
}).catch(() => {
  $('#list').innerHTML = '<div class="empty"><strong>No se pudieron cargar los productos</strong>Revisá tu conexión y recargá la página.</div>';
});
})();
