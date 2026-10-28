/**
 * reporte_semanal.js
 * Dashboard de estadísticas semanales por vendedor.
 * Datos reales de la hoja "ESTADISTICA SEMANAL 2026" vía /api/semanal.
 */

// ─── Estado y Constantes ──────────────────────────────────────────────────────

const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

// Respuesta de /api/semanal: { anio, vendedores, objetivos, semanas }
let semanalData = null;
// Por mes: { semanas, completo, tieneDatos, vendedores: { NOMBRE: {...} } }
let monthStats = [];
let selectedMonthIndex = 0;

const cardClasses = {
    'ROBERTO': 'card-roberto', 'ERNESTO': 'card-ernesto',
    'OFICINA': 'card-oficina', 'REDIPLAST': 'card-rediplast'
};

// ─── Utilidades ───────────────────────────────────────────────────────────────

const formatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const formatterShort = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });

const daysInMonth = (monthIdx) => new Date(semanalData.anio, monthIdx + 1, 0).getDate();

// Los textos vienen del Sheet; se escapan antes de insertarlos en el HTML
const escapeHtml = (str) => String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const signedMoney = (value, fmt = formatter) => `${value >= 0 ? '+' : '-'}${fmt.format(Math.abs(value))}`;

// Color según % de avance contra la meta
function statusClasses(percent) {
    if (percent >= 100) return { bar: 'bg-emerald-400', text: 'text-emerald-400' };
    if (percent >= 90)  return { bar: 'bg-secondary',   text: 'text-secondary' };
    if (percent >= 70)  return { bar: 'bg-orange-400',  text: 'text-orange-400' };
    return { bar: 'bg-red-500', text: 'text-red-400' };
}

// ─── Inicialización ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', fetchData);

// ─── Carga de Datos ───────────────────────────────────────────────────────────

async function fetchData() {
    const loader = document.getElementById('loading-overlay');
    try {
        const response = await apiFetch('/api/semanal');
        if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
        semanalData = await response.json();

        processData();
        initMonthTabs();

        // Abrir el último mes que tenga ventas cargadas
        const lastWithData = monthStats.map(m => m.tieneDatos).lastIndexOf(true);
        selectMonth(Math.max(lastWithData, 0));
    } catch (error) {
        console.error('Error al cargar la estadística semanal:', error);
        document.getElementById('vendor-cards').innerHTML = `
            <div class="md:col-span-2 glass-panel p-8 rounded-2xl text-center text-red-400">
                No se pudieron cargar los datos. Recarga la página o vuelve a iniciar sesión.
            </div>`;
    } finally {
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.classList.add('hidden'), 500);
        }
    }
}

/**
 * Agrupa las semanas por mes y calcula, por vendedor:
 * total vendido, meta del mes, meta proporcional de cada semana y proyección.
 */
function processData() {
    const { vendedores, objetivos, semanas } = semanalData;

    monthStats = monthNames.map((_, monthIdx) => {
        const semanasMes = semanas.filter(s => s.mes === monthIdx);
        const cargadas = semanasMes.filter(s => s.cargada);
        const totalDias = daysInMonth(monthIdx);
        const diasCargados = cargadas.reduce((acc, s) => acc + (s.diaFin - s.diaInicio + 1), 0);

        const stats = {
            semanas: semanasMes,
            tieneDatos: cargadas.length > 0,
            completo: semanasMes.length > 0 && cargadas.length === semanasMes.length,
            diasRestantes: Math.max(totalDias - diasCargados, 0),
            vendedores: {}
        };

        vendedores.forEach(vendor => {
            const objetivo = objetivos[vendor] || 0;
            const total = cargadas.reduce((acc, s) => acc + (s.montos[vendor] || 0), 0);

            // Meta de cada semana proporcional a sus días (ej. 4 de 31 días)
            const detalle = semanasMes.map((s, i) => {
                const dias = s.diaFin - s.diaInicio + 1;
                const meta = objetivo * dias / totalDias;
                const anterior = i > 0 && semanasMes[i - 1].cargada ? semanasMes[i - 1].montos[vendor] : null;
                return {
                    etiqueta: s.etiqueta,
                    cargada: s.cargada,
                    dias,
                    monto: s.montos[vendor] || 0,
                    meta,
                    // Comparación con la semana anterior, ajustada por días
                    variacion: s.cargada && anterior
                        ? ((s.montos[vendor] / dias) / (anterior / (semanasMes[i - 1].diaFin - semanasMes[i - 1].diaInicio + 1)) - 1) * 100
                        : null
                };
            });

            const proyeccion = diasCargados > 0 ? total / diasCargados * totalDias : 0;

            stats.vendedores[vendor] = {
                total,
                objetivo,
                deficitMes: objetivo - total,
                proyeccion,
                detalle,
                mejorSemana: detalle.filter(d => d.cargada).sort((a, b) => b.monto / b.dias - a.monto / a.dias)[0] || null
            };
        });

        return stats;
    });
}

// ─── UI y Renderizado ─────────────────────────────────────────────────────────

function initMonthTabs() {
    const container = document.getElementById('month-tabs');
    container.innerHTML = monthNames.map((m, i) => {
        const disabled = !monthStats[i].tieneDatos;
        return `
            <button onclick="selectMonth(${i})" id="tab-month-${i}" ${disabled ? 'disabled' : ''}
                    class="month-tab px-4 py-2 rounded-lg border border-white/10 font-label-caps text-xs whitespace-nowrap ${disabled ? 'text-white/20 cursor-not-allowed' : 'text-on-surface-variant hover:bg-white/5'}">
                ${m.substring(0, 3)}
            </button>`;
    }).join('');
}

function selectMonth(index) {
    document.querySelectorAll('.month-tab').forEach(tab => tab.classList.remove('active'));
    const activeTab = document.getElementById(`tab-month-${index}`);
    if (activeTab) activeTab.classList.add('active');

    selectedMonthIndex = index;
    renderSummary(index);
    renderCards(index);
    renderDeficit(index);
}

function renderSummary(monthIdx) {
    const month = monthStats[monthIdx];
    const r = month.vendedores['REDIPLAST'];
    const percent = r.objetivo > 0 ? (r.total / r.objetivo) * 100 : 0;
    const status = statusClasses(percent);

    // Mes cerrado: déficit final. Mes en curso: proyección y lo que falta por día.
    const cuartoPanel = month.completo
        ? `<p class="text-[10px] font-label-caps text-on-surface-variant mb-1">${r.deficitMes <= 0 ? 'SUPERÁVIT' : 'DÉFICIT'} DEL MES</p>
           <p class="font-mono text-xl font-bold ${r.deficitMes <= 0 ? 'text-emerald-400' : 'text-red-400'}">${signedMoney(-r.deficitMes)}</p>`
        : `<p class="text-[10px] font-label-caps text-on-surface-variant mb-1">PROYECCIÓN AL CIERRE</p>
           <p class="font-mono text-xl font-bold ${r.proyeccion >= r.objetivo ? 'text-emerald-400' : 'text-orange-400'}">${formatterShort.format(r.proyeccion)}</p>
           ${r.deficitMes > 0 && month.diasRestantes > 0
                ? `<p class="text-[10px] text-on-surface-variant mt-1">Faltan ${formatterShort.format(r.deficitMes / month.diasRestantes)} por día (${month.diasRestantes} días)</p>`
                : ''}`;

    document.getElementById('month-summary').innerHTML = `
        <div class="glass-panel p-4 rounded-xl border border-white/5">
            <p class="text-[10px] font-label-caps text-on-surface-variant mb-1">OBJETIVO ${monthNames[monthIdx]}</p>
            <p class="font-mono text-xl font-bold">${formatterShort.format(r.objetivo)}</p>
        </div>
        <div class="glass-panel p-4 rounded-xl border border-white/5">
            <p class="text-[10px] font-label-caps text-on-surface-variant mb-1">${month.completo ? 'VENTA TOTAL MES' : 'VENTA A LA FECHA'}</p>
            <p class="font-mono text-xl font-bold text-secondary">${formatterShort.format(r.total)}</p>
        </div>
        <div class="glass-panel p-4 rounded-xl border border-white/5">
            <p class="text-[10px] font-label-caps text-on-surface-variant mb-1">% ALCANCE</p>
            <p class="font-mono text-xl font-bold ${status.text}">${percent.toFixed(1)}%</p>
        </div>
        <div class="glass-panel p-4 rounded-xl border border-white/5">${cuartoPanel}</div>
    `;
}

function renderCards(monthIdx) {
    const month = monthStats[monthIdx];

    document.getElementById('vendor-cards').innerHTML = semanalData.vendedores.map(vendor => {
        const data = month.vendedores[vendor];
        const percent = data.objetivo > 0 ? (data.total / data.objetivo) * 100 : 0;
        const status = statusClasses(percent);

        let acumulado = 0;
        for (let i = 0; i <= monthIdx; i++) {
            if (monthStats[i].completo) acumulado += monthStats[i].vendedores[vendor].deficitMes;
        }

        const rows = data.detalle.map((sem, i) => {
            if (!sem.cargada) {
                return `
                    <tr class="week-row text-white/30">
                        <td class="py-2 px-3">${i + 1}</td>
                        <td class="py-2 px-3">${escapeHtml(sem.etiqueta)}</td>
                        <td class="py-2 px-3 text-right" colspan="2">pendiente</td>
                    </tr>`;
            }
            const cumple = sem.monto >= sem.meta;
            const isBest = data.mejorSemana && sem.etiqueta === data.mejorSemana.etiqueta;
            const variacion = sem.variacion === null ? '' : `
                <span class="block text-[9px] ${sem.variacion >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                    ${sem.variacion >= 0 ? '▲' : '▼'} ${Math.abs(sem.variacion).toFixed(0)}% vs ant.
                </span>`;
            return `
                <tr class="week-row transition-colors">
                    <td class="py-2 px-3 text-on-surface-variant">${i + 1}</td>
                    <td class="py-2 px-3">
                        ${escapeHtml(sem.etiqueta)}
                        ${isBest ? '<span class="material-symbols-outlined text-[12px] text-secondary align-middle" title="Mejor semana del mes">star</span>' : ''}
                    </td>
                    <td class="py-2 px-3 text-right text-on-surface-variant">${formatterShort.format(sem.meta)}</td>
                    <td class="py-2 px-3 text-right">
                        <span class="${cumple ? 'text-emerald-400' : 'text-red-400'}">${formatter.format(sem.monto)}</span>
                        ${variacion}
                    </td>
                </tr>`;
        }).join('');

        const isPositive = data.deficitMes <= 0;
        const filaMes = month.completo
            ? `<span class="text-xs font-label-caps text-on-surface-variant">${isPositive ? 'SUPERÓ OBJETIVO' : 'LE FALTÓ'} ESTE MES</span>`
            : `<span class="text-xs font-label-caps text-on-surface-variant">${isPositive ? 'YA SUPERÓ EL OBJETIVO' : 'LE FALTA PARA LA META'}</span>`;

        return `
            <div class="glass-panel p-6 rounded-2xl ${cardClasses[vendor] || ''} card-anim relative overflow-hidden">
                <div class="flex justify-between items-start mb-6">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                            <span class="material-symbols-outlined text-white/80">${vendor === 'REDIPLAST' ? 'factory' : 'person'}</span>
                        </div>
                        <div>
                            <h3 class="font-headline-sm text-lg">${escapeHtml(vendor)}</h3>
                            <p class="text-xs text-on-surface-variant font-label-caps">Objetivo: ${formatter.format(data.objetivo)}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-bold font-mono ${status.text}">${percent.toFixed(1)}%</span>
                        ${month.completo ? '' : `<p class="text-[10px] font-label-caps text-on-surface-variant">Proyección ${formatterShort.format(data.proyeccion)}</p>`}
                    </div>
                </div>

                <div class="h-2 w-full bg-white/10 rounded-full mb-6 overflow-hidden">
                    <div class="h-full ${status.bar} rounded-full" style="width: ${Math.min(percent, 100)}%"></div>
                </div>

                <div class="bg-[#0a0a0a]/50 rounded-lg border border-white/5 overflow-x-auto mb-6">
                    <table class="w-full text-sm text-left">
                        <thead class="text-[10px] font-label-caps text-on-surface-variant border-b border-white/5 bg-white/5">
                            <tr>
                                <th class="py-2 px-3 w-10">SEM</th>
                                <th class="py-2 px-3">PERÍODO</th>
                                <th class="py-2 px-3 text-right">META</th>
                                <th class="py-2 px-3 text-right">VENTA</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5 font-mono text-xs">${rows}</tbody>
                        <tfoot class="border-t border-white/10 bg-white/5 font-bold">
                            <tr>
                                <td colspan="3" class="py-3 px-3 text-right text-xs font-label-caps text-secondary">TOTAL VENDIDO</td>
                                <td class="py-3 px-3 text-right text-secondary">${formatter.format(data.total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div class="space-y-2">
                    <div class="flex items-center justify-between p-3 rounded-lg bg-surface-container-highest border ${isPositive ? 'border-emerald-500/20' : 'border-red-500/20'}">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-[18px] ${isPositive ? 'text-emerald-400' : 'text-red-400'}">${isPositive ? 'check_circle' : 'warning'}</span>
                            ${filaMes}
                        </div>
                        <span class="font-mono text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}">
                            ${signedMoney(-data.deficitMes)}
                        </span>
                    </div>
                    <div class="flex items-center justify-between p-3 rounded-lg bg-[#0e0e0e] border border-white/5">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-[18px] text-secondary">stacked_line_chart</span>
                            <span class="text-xs font-label-caps text-on-surface-variant">DÉFICIT ACUMULADO (MESES CERRADOS)</span>
                        </div>
                        <span class="font-mono text-sm font-bold ${acumulado <= 0 ? 'text-emerald-400' : 'text-red-400'}">
                            ${signedMoney(-acumulado)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderDeficit(currentMonthIdx) {
    const vendors = semanalData.vendedores;

    // Déficit acumulado: solo meses cerrados, para no castigar al mes en curso
    const maxDeficit = Math.max(...vendors.map(vendor => {
        let saldo = 0;
        for (let i = 0; i <= currentMonthIdx; i++) {
            if (monthStats[i].completo) saldo += monthStats[i].vendedores[vendor].deficitMes;
        }
        return Math.abs(saldo);
    }), 1);

    document.getElementById('deficit-section').innerHTML = vendors.map(vendor => {
        let timelineHtml = '';
        let saldo = 0;
        let first = true;

        for (let i = 0; i <= currentMonthIdx; i++) {
            if (!monthStats[i].completo) continue;
            const dataMes = monthStats[i].vendedores[vendor];
            saldo += dataMes.deficitMes;
            const isRecuperacion = dataMes.deficitMes < 0;
            const arrow = first ? '' : `<span class="material-symbols-outlined text-[14px] text-white/20 mx-1">arrow_right_alt</span>`;
            first = false;

            timelineHtml += `
                ${arrow}
                <div class="flex flex-col items-center">
                    <span class="text-[9px] font-label-caps text-on-surface-variant">${monthNames[i].substring(0, 3)}</span>
                    <span class="text-[10px] font-mono font-bold ${isRecuperacion ? 'text-emerald-400' : 'text-red-400'}">
                        ${signedMoney(-dataMes.deficitMes, formatterShort)}
                    </span>
                </div>
            `;
        }

        const colorBar = saldo <= 0 ? 'bg-emerald-400' : 'bg-red-500';
        const widthPct = Math.min((Math.abs(saldo) / maxDeficit) * 100, 100);

        return `
            <div class="mb-4 last:mb-0">
                <div class="flex justify-between items-end mb-2 gap-4">
                    <div class="flex items-center gap-4 min-w-0">
                        <span class="font-headline-sm text-sm w-24 shrink-0">${escapeHtml(vendor)}</span>
                        <div class="hidden md:flex items-center bg-white/5 px-3 py-1.5 rounded border border-white/5 overflow-x-auto">${timelineHtml}</div>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="text-[10px] font-label-caps text-on-surface-variant">SALDO ACTUAL</p>
                        <p class="font-mono font-bold text-lg ${saldo <= 0 ? 'text-emerald-400' : 'text-red-400'}">
                            ${signedMoney(-saldo)}
                        </p>
                    </div>
                </div>
                <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full ${colorBar} rounded-full deficit-bar" style="width: ${widthPct}%"></div>
                </div>
            </div>
        `;
    }).join('');
}
