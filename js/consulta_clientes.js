/**
 * consulta_clientes.js
 * Cuadro "Consulta por cliente" del Dashboard: análisis mes a mes de un cliente
 * y respuestas a preguntas simples ("¿qué meses compró?", "¿subió o bajó?").
 * Usa clientsDb, months y monthNamesFull de dashboard.js. No llama a ninguna IA:
 * todas las respuestas se calculan con los datos del Sheet.
 */

let consultaCliente = null;

const consultaFmt = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const MONTH_CODES = Object.keys(months);

// Nombres de mes como los puede escribir el usuario (sin tildes)
const MONTH_ALIASES = {
    ENE: ['enero', 'ene'],   FEB: ['febrero', 'feb'],  MAR: ['marzo', 'mar'],
    ABR: ['abril', 'abr'],   MAY: ['mayo', 'may'],     JUN: ['junio', 'jun'],
    JUL: ['julio', 'jul'],   AGO: ['agosto', 'ago'],   SEP: ['septiembre', 'setiembre', 'sep', 'set'],
    OCT: ['octubre', 'oct'], NOV: ['noviembre', 'nov'], DIC: ['diciembre', 'dic']
};

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function normalizar(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,]/g, ' ');
}

// ─── Cálculos ─────────────────────────────────────────────────────────────────

/** Meses del año que ya tienen datos cargados (hasta el último con ventas de cualquier cliente). */
function mesesTranscurridos() {
    let last = -1;
    MONTH_CODES.forEach((code, idx) => { if (clientsDb.some(c => c.sales[idx] > 0)) last = idx; });
    return MONTH_CODES.slice(0, last + 1);
}

function mesEnCurso() {
    const today = new Date();
    return today.getFullYear() === 2026 ? MONTH_CODES[today.getMonth()] : null;
}

function nombreMes(code) {
    return monthNamesFull[code] + (code === mesEnCurso() ? ' (en curso)' : '');
}

function listaMeses(codes) {
    const names = codes.map(c => monthNamesFull[c]);
    return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

function analizarCliente(client) {
    const meses    = mesesTranscurridos();
    const enCurso  = mesEnCurso();
    const venta    = code => client.sales[months[code]];
    const compro   = meses.filter(c => venta(c) > 0);
    const noCompro = meses.filter(c => venta(c) === 0);
    const total    = compro.reduce((s, c) => s + venta(c), 0);
    const cerrados = meses.filter(c => c !== enCurso);

    const mejor = compro.reduce((a, c) => (!a || venta(c) > venta(a) ? c : a), null);
    const menor = compro.reduce((a, c) => (!a || venta(c) < venta(a) ? c : a), null);
    const ultimaCompra = compro[compro.length - 1] || null;

    // Racha: meses cerrados seguidos (contando desde el último) con o sin compra
    let racha = 0;
    const ultimoCerrado = cerrados[cerrados.length - 1];
    const comproUltimo = ultimoCerrado && venta(ultimoCerrado) > 0;
    for (let i = cerrados.length - 1; i >= 0; i--) {
        if ((venta(cerrados[i]) > 0) !== comproUltimo) break;
        racha++;
    }

    // Tendencia: promedio de los últimos 3 meses cerrados vs los 3 anteriores
    const sumar = arr => arr.reduce((s, c) => s + venta(c), 0);
    const ult3  = cerrados.slice(-3);
    const ant3  = cerrados.slice(-6, -3);
    const cambio = sumar(ant3) > 0 ? (sumar(ult3) / ult3.length) / (sumar(ant3) / ant3.length) - 1 : null;

    const inactivo = compro.length > 0 && !comproUltimo && racha >= 2 && !(enCurso && venta(enCurso) > 0);

    let estado;
    if (compro.length === 0) {
        estado = { texto: 'Sin compras en 2026', cls: 'bg-white/10 text-slate-300' };
    } else if (inactivo) {
        estado = { texto: `Inactivo · ${racha} meses sin comprar`, cls: 'bg-red-400/15 text-red-400' };
    } else if (cambio === null) {
        estado = { texto: 'Cliente reciente', cls: 'bg-secondary/15 text-secondary' };
    } else if (cambio > 0.15) {
        estado = { texto: `Subiendo ▲ ${(cambio * 100).toFixed(0)}%`, cls: 'bg-emerald-400/15 text-emerald-400' };
    } else if (cambio < -0.15) {
        estado = { texto: `Bajando ▼ ${(Math.abs(cambio) * 100).toFixed(0)}%`, cls: 'bg-red-400/15 text-red-400' };
    } else {
        estado = { texto: 'Estable', cls: 'bg-yellow-400/15 text-yellow-400' };
    }

    return {
        meses, enCurso, venta, compro, noCompro, total, mejor, menor, ultimaCompra,
        racha, comproUltimo, ultimoCerrado, ult3, ant3, cambio, estado, inactivo,
        promedio: compro.length ? total / compro.length : 0
    };
}

/** Texto de variación de un mes contra el anterior. */
function variacion(a, code) {
    const idx  = a.meses.indexOf(code);
    const cur  = a.venta(code);
    if (idx === 0) return { texto: '—', cls: 'text-on-surface-variant' };
    const prev = a.venta(a.meses[idx - 1]);
    if (cur === 0 && prev === 0) return { texto: '—', cls: 'text-on-surface-variant' };
    if (cur === 0) return { texto: 'No compró', cls: 'text-red-400' };
    if (prev === 0) {
        const comproAntes = a.meses.slice(0, idx).some(c => a.venta(c) > 0);
        return { texto: comproAntes ? 'Volvió a comprar' : 'Primera compra', cls: 'text-emerald-400' };
    }
    const pct = (cur / prev - 1) * 100;
    return pct >= 0
        ? { texto: `▲ ${pct.toFixed(1)}%`, cls: 'text-emerald-400' }
        : { texto: `▼ ${Math.abs(pct).toFixed(1)}%`, cls: 'text-red-400' };
}

// ─── Respuestas ───────────────────────────────────────────────────────────────

const NUMEROS = { un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };

/** Últimos meses para analizar tendencia: n meses cerrados, más el mes en curso si lo hay. */
function ultimosMeses(a, n) {
    const cerrados = a.meses.filter(c => c !== a.enCurso).slice(-n);
    return a.meses.includes(a.enCurso) ? [...cerrados, a.enCurso] : cerrados;
}

/**
 * Tramo pedido con "últimos 4 meses" (4 meses contando el actual), "último trimestre"
 * (3 meses cerrados) o "últimas compras" / "últimamente" (3 cerrados + el actual). null si no aplica.
 */
function tramoUltimos(q, a) {
    const cerrados = a.meses.filter(c => c !== a.enCurso);
    if (q.includes('ultimo trimestre')) return cerrados.slice(-3);
    if (q.includes('ultimo semestre'))  return cerrados.slice(-6);
    const m = q.match(/ultim[oa]s?\s+(\d+|[a-z]+)\s+(meses|mes|compras)/);
    if (m) {
        const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMEROS[m[1]];
        if (n) return a.meses.slice(-n);
    }
    if (/ultim[oa]s (meses|compras)|ultimamente|ultimo tiempo/.test(q)) return ultimosMeses(a, 3);
    return null;
}

/** Analiza un tramo de meses: detalle mes a mes y una conclusión razonada. */
function respuestaRango(a, codes) {
    if (a.compro.length === 0) return 'Este cliente no registra compras en 2026.';
    const fmt = v => consultaFmt.format(v);

    const filas = codes.map(code => {
        const v  = a.venta(code);
        const vr = variacion(a, code);
        const extra = vr.texto !== '—' && v > 0 ? ` <span class="${vr.cls}">${vr.texto}</span>` : '';
        return `• ${nombreMes(code)}: ${v > 0 ? `<b>${fmt(v)}</b>` : '<span class="text-red-400">no compró</span>'}${extra}`;
    });

    const partes   = [`<b>${monthNamesFull[codes[0]]} a ${monthNamesFull[codes[codes.length - 1]]}:</b>`, ...filas, ''];
    const cerrados = codes.filter(c => c !== a.enCurso);
    const vals     = cerrados.map(a.venta);

    if (a.inactivo && cerrados.includes(a.ultimoCerrado)) {
        partes.push(`🚫 Está <b>inactivo</b>: no compra desde ${monthNamesFull[a.ultimaCompra]} (${a.racha} meses cerrados sin comprar).`);
    } else if (vals.length >= 2 && vals.some(v => v > 0)) {
        let subidas = 0, bajadas = 0;
        for (let i = 1; i < vals.length; i++) {
            if (vals[i] > vals[i - 1]) subidas++;
            else if (vals[i] < vals[i - 1]) bajadas++;
        }
        const pares = vals.length - 1;
        const [ini, fin] = [vals[0], vals[vals.length - 1]];
        const [mIni, mFin] = [monthNamesFull[cerrados[0]], monthNamesFull[cerrados[cerrados.length - 1]]];
        const pct = ini > 0 ? (fin / ini - 1) * 100 : null;
        const pctTxt = pct === null ? '' : ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;

        if (bajadas === pares) {
            partes.push(`📉 Viene <b>bajando</b> mes a mes: pasó de ${fmt(ini)} en ${mIni} a ${fmt(fin)} en ${mFin}${pctTxt}.`);
        } else if (subidas === pares) {
            partes.push(`📈 Viene <b>subiendo</b> mes a mes: pasó de ${fmt(ini)} en ${mIni} a ${fmt(fin)} en ${mFin}${pctTxt}.`);
        } else {
            const resumen = pct === null ? `en ${mFin} cerró con ${fmt(fin)}`
                : Math.abs(pct) <= 5 ? `entre ${mIni} y ${mFin} quedó casi igual${pctTxt}`
                : `entre ${mIni} y ${mFin} ${pct > 0 ? 'subió' : 'bajó'}${pctTxt}`;
            partes.push(`↕️ Tiene <b>altibajos</b> (${subidas} ${subidas === 1 ? 'subida' : 'subidas'} y ${bajadas} ${bajadas === 1 ? 'bajada' : 'bajadas'}); ${resumen}.`);
        }

        // Comparación con el mismo número de meses inmediatamente anteriores
        const idx   = a.meses.indexOf(cerrados[0]);
        const antes = a.meses.slice(Math.max(0, idx - cerrados.length), idx);
        const sumar = arr => arr.reduce((s, c) => s + a.venta(c), 0);
        if (antes.length === cerrados.length && sumar(antes) > 0) {
            const p = (sumar(cerrados) / sumar(antes) - 1) * 100;
            partes.push(`Frente a los ${antes.length} meses anteriores (${monthNamesFull[antes[0]]} a ${monthNamesFull[antes[antes.length - 1]]}) compró ${Math.abs(p).toFixed(1)}% ${p >= 0 ? 'más' : 'menos'}: ${fmt(sumar(cerrados))} contra ${fmt(sumar(antes))}.`);
        }
    } else if (vals.length === 1) {
        partes.push(`${monthNamesFull[cerrados[0]]} es el único mes cerrado del tramo.`);
    }

    if (codes.includes(a.enCurso)) {
        const v = a.venta(a.enCurso);
        const cerradosConCompra = a.compro.filter(c => c !== a.enCurso);
        const prom = cerradosConCompra.length ? cerradosConCompra.reduce((s, c) => s + a.venta(c), 0) / cerradosConCompra.length : 0;
        partes.push(v > 0
            ? `⏳ ${monthNamesFull[a.enCurso]} sigue en curso: lleva ${fmt(v)}${prom > 0 ? `, el ${(v / prom * 100).toFixed(0)}% de lo que compra en un mes normal (${fmt(prom)})` : ''}. Todavía puede subir.`
            : `⏳ En ${monthNamesFull[a.enCurso]} (en curso) todavía no compra.`);
    }
    return partes.join('<br>');
}

function respuestaMes(a, code) {
    if (!a.meses.includes(code)) return `${monthNamesFull[code]} todavía no tiene datos cargados.`;
    const v = a.venta(code);
    if (v === 0) {
        return `En ${nombreMes(code)} <b>no compró</b>.` +
            (a.ultimaCompra ? ` Su última compra fue en ${monthNamesFull[a.ultimaCompra]} por ${consultaFmt.format(a.venta(a.ultimaCompra))}.` : '');
    }
    const var_ = variacion(a, code);
    const vsProm = a.promedio > 0 ? (v / a.promedio - 1) * 100 : 0;
    return `En ${nombreMes(code)} compró <b>${consultaFmt.format(v)}</b>.` +
        (var_.texto !== '—' ? ` Contra el mes anterior: ${var_.texto}.` : '') +
        ` Está ${vsProm >= 0 ? `${vsProm.toFixed(0)}% por encima` : `${Math.abs(vsProm).toFixed(0)}% por debajo`} de su promedio (${consultaFmt.format(a.promedio)}).` +
        (code === a.mejor ? ' Es su mejor mes del año. ⭐' : '');
}

function respuestaComparar(a, c1, c2) {
    const [x, y] = months[c1] < months[c2] ? [c1, c2] : [c2, c1];
    const vx = a.venta(x), vy = a.venta(y);
    if (vx === 0 && vy === 0) return `No compró ni en ${monthNamesFull[x]} ni en ${monthNamesFull[y]}.`;
    let res = `${monthNamesFull[x]}: <b>${consultaFmt.format(vx)}</b> · ${nombreMes(y)}: <b>${consultaFmt.format(vy)}</b>.<br>`;
    if (vx === 0) res += `En ${monthNamesFull[y]} compró y en ${monthNamesFull[x]} no.`;
    else if (vy === 0) res += `En ${monthNamesFull[y]} no compró.`;
    else {
        const pct = (vy / vx - 1) * 100;
        res += `De ${monthNamesFull[x]} a ${monthNamesFull[y]} ${pct >= 0 ? 'subió' : 'bajó'} ${Math.abs(pct).toFixed(1)}% (${pct >= 0 ? '+' : '-'}${consultaFmt.format(Math.abs(vy - vx))}).`;
    }
    if (y === a.enCurso) res += `<br>⏳ ${monthNamesFull[y]} sigue en curso, así que la cifra todavía puede subir.`;
    return res;
}

const AYUDA = 'Puedo responder cosas como: <i>¿cómo viene los últimos 4 meses?</i>, <i>¿viene subiendo o bajando?</i>, ' +
    '<i>¿cómo le fue de junio a octubre?</i>, <i>compara junio con octubre</i>, <i>¿cuánto compró en marzo?</i>, ' +
    '<i>¿qué meses compró / no compró?</i>, <i>¿cuál fue su mejor mes?</i>, <i>¿cuánto lleva en total?</i>, <i>¿cuándo fue su última compra?</i>';

const PALABRAS_TENDENCIA = ['subio', 'bajo', 'subiendo', 'bajando', ' sube', ' baja', 'tendencia', 'evolucion',
    'como va', 'como viene', 'viene', 'como esta', 'crec', 'cay', 'mejorando', 'empeorando', 'comportamiento', 'como le fue'];

function responder(pregunta, a) {
    const q = ` ${normalizar(pregunta).replace(/\s+/g, ' ')} `;
    const tiene = (...palabras) => palabras.some(p => q.includes(p));

    // 1. Tramos: "últimos 4 meses", "últimas compras", "último trimestre"
    const tramo = tramoUltimos(q, a);
    if (tramo && tramo.length) return respuestaRango(a, tramo);

    // 2. Meses nombrados: un tramo ("de junio a octubre", "desde julio"), una comparación o un mes
    const mesesPedidos = MONTH_CODES.filter(code =>
        MONTH_ALIASES[code].some(alias => new RegExp(`\\s${alias}\\s`).test(q)));
    const pideTramo = tiene(' a ', 'hasta', 'desde', 'entre') && !tiene('compar', ' vs ', ' contra ');
    if (mesesPedidos.length >= 2) {
        const [x, y] = [mesesPedidos[0], mesesPedidos[mesesPedidos.length - 1]];
        if (!pideTramo) return respuestaComparar(a, x, y);
        const tramo = a.meses.slice(months[x], months[y] + 1);
        return tramo.length ? respuestaRango(a, tramo) : `${monthNamesFull[x]} todavía no tiene datos cargados.`;
    }
    if (mesesPedidos.length === 1) {
        const code = mesesPedidos[0];
        if (tiene('desde') && a.meses.includes(code)) return respuestaRango(a, a.meses.slice(months[code]));
        return respuestaMes(a, code);
    }

    // 3. Preguntas puntuales
    if (tiene(' no compro', ' no ha comprado', 'sin compra', 'sin comprar', 'dejo de', 'falto', 'no hizo')) {
        if (a.noCompro.length === 0) return 'Compró en <b>todos</b> los meses del año. 👏';
        return `No compró en <b>${a.noCompro.length}</b> de ${a.meses.length} meses: ${listaMeses(a.noCompro)}.`;
    }
    // "mejorando"/"empeorando" son tendencia, no mejor/peor mes
    const esTendencia = tiene('mejorando', 'empeorando');
    if (!esTendencia && tiene('mejor', 'mas compro', 'mayor', 'maximo', 'mas alto')) {
        return a.mejor ? `Su mejor mes fue <b>${monthNamesFull[a.mejor]}</b> con ${consultaFmt.format(a.venta(a.mejor))}.` : 'Aún no registra compras.';
    }
    if (!esTendencia && tiene('peor', 'menos compro', 'menor', 'minimo', 'mas bajo')) {
        return a.menor ? `El mes que menos compró (sin contar los meses sin compra) fue <b>${monthNamesFull[a.menor]}</b> con ${consultaFmt.format(a.venta(a.menor))}.` : 'Aún no registra compras.';
    }
    if (tiene('ultima', 'ultimo', 'cuando compro', 'reciente')) {
        if (!a.ultimaCompra) return 'Aún no registra compras.';
        return `Su última compra fue en <b>${nombreMes(a.ultimaCompra)}</b> por ${consultaFmt.format(a.venta(a.ultimaCompra))}.` +
            (!a.comproUltimo && a.racha > 0 ? ` Lleva ${a.racha} ${a.racha === 1 ? 'mes cerrado' : 'meses cerrados'} sin comprar.` : '');
    }
    if (tiene('promedio')) {
        return a.compro.length ? `Compra en promedio <b>${consultaFmt.format(a.promedio)}</b> en los meses que compra, y ${consultaFmt.format(a.total / a.meses.length)} si se reparte entre los ${a.meses.length} meses del año.` : 'Aún no registra compras.';
    }
    if (tiene('total', 'acumulado', 'cuanto lleva', 'cuanto ha comprado', 'en el ano')) {
        return `En lo que va de 2026 lleva <b>${consultaFmt.format(a.total)}</b> en ${a.compro.length} ${a.compro.length === 1 ? 'mes' : 'meses'} con compra.`;
    }
    if (tiene('vendedor', 'quien lo atiende', 'quien le vende')) {
        return `Lo atiende <b>${escapeHtml(consultaCliente.seller)}</b>.`;
    }

    // 4. Tendencia general: últimos 3 meses cerrados más el mes en curso
    if (tiene(...PALABRAS_TENDENCIA)) return respuestaRango(a, ultimosMeses(a, 3));

    if (tiene('que meses', 'cuales meses', 'en que mes', 'meses compro', 'compro', 'frecuencia', 'cada cuanto')) {
        if (a.compro.length === 0) return 'Aún no registra compras en 2026.';
        return `Compró en <b>${a.compro.length}</b> de ${a.meses.length} meses: ${listaMeses(a.compro)}.` +
            (a.noCompro.length ? ` No compró en ${listaMeses(a.noCompro)}.` : '');
    }
    return `No entendí la pregunta. ${AYUDA}`;
}

// ─── Interfaz ─────────────────────────────────────────────────────────────────

function agregarMensaje(html, deUsuario) {
    const chat = document.getElementById('consulta-chat');
    chat.insertAdjacentHTML('beforeend', deUsuario
        ? `<div class="flex justify-end"><div class="bg-secondary/15 text-secondary rounded-lg px-3 py-2 text-sm max-w-[85%]">${escapeHtml(html)}</div></div>`
        : `<div class="flex"><div class="bg-white/5 text-slate-200 rounded-lg px-3 py-2 text-sm max-w-[90%] leading-relaxed">${html}</div></div>`);
    chat.scrollTop = chat.scrollHeight;
}

function preguntar(texto) {
    if (!consultaCliente || !texto.trim()) return;
    agregarMensaje(texto, true);
    agregarMensaje(responder(texto, analizarCliente(consultaCliente)), false);
}

function seleccionarConsultaCliente(name) {
    consultaCliente = clientsDb.find(c => c.name === name);
    if (!consultaCliente) return;
    const a = analizarCliente(consultaCliente);

    document.getElementById('consulta-dropdown').classList.add('hidden');
    document.getElementById('consulta-search').value = '';
    document.getElementById('consulta-empty').classList.add('hidden');
    document.getElementById('consulta-body').classList.remove('hidden');

    document.getElementById('consulta-name').innerText   = consultaCliente.name;
    document.getElementById('consulta-seller').innerText = consultaCliente.seller;
    const status = document.getElementById('consulta-status');
    status.innerText = a.estado.texto;
    status.className = `self-start sm:self-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${a.estado.cls}`;

    document.getElementById('consulta-resumen').innerHTML = a.compro.length === 0
        ? '<p>Este cliente no registra compras en 2026.</p>'
        : `<p>💰 Lleva <b class="text-white">${consultaFmt.format(a.total)}</b> en 2026 · compró en ${a.compro.length} de ${a.meses.length} meses.</p>
           <p>⭐ Mejor mes: <b class="text-white">${monthNamesFull[a.mejor]}</b> (${consultaFmt.format(a.venta(a.mejor))}) · Promedio cuando compra: ${consultaFmt.format(a.promedio)}.</p>
           <p>🛒 Última compra: <b class="text-white">${nombreMes(a.ultimaCompra)}</b>${!a.comproUltimo && a.racha > 0 ? ` · lleva ${a.racha} ${a.racha === 1 ? 'mes' : 'meses'} sin comprar` : ''}.</p>`;

    document.getElementById('consulta-tabla').innerHTML = a.meses.map(code => {
        const v   = a.venta(code);
        const var_ = variacion(a, code);
        return `<tr class="${code === a.mejor ? 'bg-secondary/5' : ''}">
            <td class="px-4 py-2 text-white">${nombreMes(code)}${code === a.mejor ? ' ⭐' : ''}</td>
            <td class="px-4 py-2 text-right font-mono ${v > 0 ? 'text-white' : 'text-on-surface-variant'}">${v > 0 ? consultaFmt.format(v) : '—'}</td>
            <td class="px-4 py-2 text-right text-xs font-bold ${var_.cls}">${var_.texto}</td>
        </tr>`;
    }).join('');

    document.getElementById('consulta-chat').innerHTML = '';
}

const CHIPS = ['¿Qué meses compró?', '¿Qué meses no compró?', '¿Subió o bajó?', '¿Cuál fue su mejor mes?', '¿Cuándo fue su última compra?'];

function openConsulta() {
    const modal = document.getElementById('consulta-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'items-center', 'justify-center');
    document.getElementById('consulta-chips').innerHTML = CHIPS.map(c =>
        `<button type="button" class="consulta-chip px-3 py-1 rounded-full border border-white/10 text-xs text-slate-300 hover:border-secondary hover:text-secondary transition-colors">${c}</button>`).join('');
    document.getElementById('consulta-search').focus();
}

function closeConsulta() {
    const modal = document.getElementById('consulta-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex', 'items-center', 'justify-center');
}

window.addEventListener('DOMContentLoaded', () => {
    const input    = document.getElementById('consulta-search');
    const dropdown = document.getElementById('consulta-dropdown');

    input.addEventListener('input', () => {
        const q = normalizar(input.value).trim();
        if (q.length < 2) { dropdown.classList.add('hidden'); return; }
        const matches = clientsDb.filter(c => normalizar(c.name).includes(q)).slice(0, 8);
        dropdown.classList.remove('hidden');
        dropdown.innerHTML = matches.length === 0
            ? '<div class="px-4 py-3 text-sm text-on-surface-variant italic text-center">No se encontraron clientes</div>'
            : matches.map(c => `
                <div data-name="${escapeHtml(c.name)}" class="consulta-opcion px-4 py-3 text-sm text-white hover:bg-white/10 hover:text-secondary cursor-pointer transition-colors flex justify-between items-center">
                    <span class="font-medium">${escapeHtml(c.name)}</span>
                    <span class="text-xs font-label-caps text-on-surface-variant">${escapeHtml(c.seller)}</span>
                </div>`).join('');
    });

    dropdown.addEventListener('click', e => {
        const opcion = e.target.closest('.consulta-opcion');
        if (opcion) seleccionarConsultaCliente(opcion.dataset.name);
    });

    document.getElementById('consulta-chips').addEventListener('click', e => {
        const chip = e.target.closest('.consulta-chip');
        if (chip) preguntar(chip.innerText);
    });

    document.getElementById('consulta-form').addEventListener('submit', e => {
        e.preventDefault();
        const campo = document.getElementById('consulta-pregunta');
        preguntar(campo.value);
        campo.value = '';
    });
});
