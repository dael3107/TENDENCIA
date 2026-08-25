/**
 * dashboard.js
 * Lógica principal del Dashboard de ventas TENDENCIA 2026.
 * Datos obtenidos desde el servidor Node.js (/api/clientes).
 */

// Estado global
let clientsDb = [];
let selectedMonthCode = null;

// Constantes de meses
const months = {
    'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4,  'JUN': 5,
    'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11
};

const monthNamesFull = {
    'ENE': 'Enero',      'FEB': 'Febrero',    'MAR': 'Marzo',     'ABR': 'Abril',
    'MAY': 'Mayo',       'JUN': 'Junio',      'JUL': 'Julio',     'AGO': 'Agosto',
    'SEP': 'Septiembre', 'OCT': 'Octubre',    'NOV': 'Noviembre', 'DIC': 'Diciembre'
};

/**
 * Parsea valores de venta en formato moneda ("S/.12,000") o número directo.
 */
function parseSalesValue(valStr) {
    if (!valStr) return 0;
    const clean = String(valStr).replace(/S\/\.?\s?/g, '').replace(/,/g, '').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

// ─── Carga de datos ───────────────────────────────────────────────────────────

async function fetchClientsData() {
    const loader = document.getElementById('loading-overlay');
    try {
        if (loader) loader.classList.remove('hidden', 'opacity-0');

        const response = await fetch('/api/clientes');
        if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
        const data = await response.json();

        const fullToCode = {
            'ENERO': 'ENE', 'FEBRERO': 'FEB', 'MARZO': 'MAR',     'ABRIL': 'ABR',
            'MAYO':  'MAY', 'JUNIO':   'JUN', 'JULIO': 'JUL',     'AGOSTO': 'AGO',
            'SEPTIEMBRE': 'SEP', 'OCTUBRE': 'OCT', 'NOVIEMBRE': 'NOV', 'DICIEMBRE': 'DIC'
        };

        clientsDb = data
            .filter(item => item.CLIENTE && String(item.CLIENTE).trim() !== '')
            .map(item => ({
                name: String(item.CLIENTE),
                seller: String(item.VENDEDOR || 'OFICINA'),
                sales: [
                    parseSalesValue(item.ENERO),    parseSalesValue(item.FEBRERO),
                    parseSalesValue(item.MARZO),    parseSalesValue(item.ABRIL),
                    parseSalesValue(item.MAYO),     parseSalesValue(item.JUNIO),
                    parseSalesValue(item.JULIO),    parseSalesValue(item.AGOSTO),
                    parseSalesValue(item.SEPTIEMBRE), parseSalesValue(item.OCTUBRE),
                    parseSalesValue(item.NOVIEMBRE),  parseSalesValue(item.DICIEMBRE)
                ],
                isNewInMonth: fullToCode[(item['C NUEVO'] || '').toString().trim().toUpperCase()] || null
            }));

        console.log(`Dashboard: ${clientsDb.length} clientes cargados.`);
        selectMonth(selectedMonthCode);
        updateBarChart();

    } catch (err) {
        console.error('Error al cargar datos del dashboard:', err);
    } finally {
        if (loader) {
            loader.classList.add('opacity-0');
            setTimeout(() => loader.classList.add('hidden'), 500);
        }
    }
}

// ─── Selección de mes ─────────────────────────────────────────────────────────

function selectMonth(monthCode) {
    selectedMonthCode = monthCode;

    const titleEl = document.getElementById('selected-month-title');
    const countEl = document.getElementById('new-clients-count');

    if (monthCode) {
        titleEl.innerText = `${monthNamesFull[monthCode]} 2026`;
        countEl.style.display = '';
    } else {
        titleEl.innerText = '— Selecciona un mes';
        countEl.style.display = 'none';
    }

    Object.keys(months).forEach(code => {
        const btn = document.getElementById(`btn-month-${code}`);
        if (!btn) return;
        if (code === monthCode) {
            btn.className = 'group glass-panel p-6 rounded-xl border border-secondary transition-all text-center bg-secondary/10';
            const lc = btn.querySelector('.font-label-caps');
            if (lc) lc.className = 'font-label-caps text-[12px] text-secondary mb-2';
            const hl = btn.querySelector('.font-headline-sm');
            if (hl) hl.className = 'font-headline-sm scale-110 text-secondary transition-transform';
        } else {
            btn.className = 'group glass-panel p-6 rounded-xl border border-transparent hover:border-secondary/30 transition-all text-center';
            const lc = btn.querySelector('.font-label-caps');
            if (lc) lc.className = 'font-label-caps text-[12px] text-on-surface-variant group-hover:text-secondary mb-2';
            const hl = btn.querySelector('.font-headline-sm');
            if (hl) hl.className = 'font-headline-sm group-hover:scale-110 transition-transform text-white';
        }
    });

    renderNewClients(monthCode);
    updateBarChart();
}

// ─── Gráfico de barras ────────────────────────────────────────────────────────

function updateBarChart() {
    const totals = { 'ENE':0,'FEB':0,'MAR':0,'ABR':0,'MAY':0,'JUN':0,'JUL':0,'AGO':0,'SEP':0,'OCT':0,'NOV':0,'DIC':0 };
    clientsDb.forEach(c => Object.keys(months).forEach(code => { totals[code] += c.sales[months[code]]; }));

    const maxTotal = Math.max(...Object.values(totals), 1);
    const fmt = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });

    Object.keys(totals).forEach(code => {
        const barDiv = document.getElementById(`bar-${code}`);
        if (!barDiv) return;
        const total    = totals[code];
        const hasSales = total > 0;

        barDiv.style.height = `${Math.max(5, (total / maxTotal) * 95)}%`;
        barDiv.className = hasSales
            ? 'flex-1 bg-secondary rounded-t-sm hover:scale-x-105 transition-all group relative cursor-pointer flex flex-col justify-end'
            : 'flex-1 bg-surface-container-highest/30 rounded-t-sm transition-all group relative flex flex-col justify-end';

        const tooltip = barDiv.querySelector('.tooltip-val');
        if (tooltip) {
            tooltip.innerText   = fmt.format(total);
            tooltip.className   = hasSales
                ? 'tooltip-val absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-label-caps text-secondary bg-background px-1.5 py-0.5 rounded shadow font-bold opacity-100'
                : 'tooltip-val absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-label-caps text-on-surface-variant opacity-0 bg-background px-1.5 py-0.5 rounded shadow';
        }
    });
}

// ─── Tabla de clientes nuevos ─────────────────────────────────────────────────

function renderNewClients(monthCode) {
    const tbody = document.getElementById('new-clients-table-body');
    const fmt   = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

    if (!monthCode) {
        document.getElementById('new-clients-count').style.display = 'none';
        tbody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-on-surface-variant italic">Selecciona un mes para ver los clientes nuevos.</td></tr>`;
        return;
    }

    const newClients = clientsDb.filter(c => c.isNewInMonth === monthCode);
    document.getElementById('new-clients-count').innerText =
        `${newClients.length} ${newClients.length === 1 ? 'CLIENTE NUEVO' : 'CLIENTES NUEVOS'}`;

    if (newClients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-on-surface-variant italic">No se registraron nuevos clientes en ${monthNamesFull[monthCode]}.</td></tr>`;
        return;
    }

    tbody.innerHTML = newClients.map(c => {
        const total = c.sales.reduce((a, b) => a + b, 0);
        return `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="py-4 pl-2">
                    <button onclick="showClientDetail('${c.name.replace(/'/g, "\\'")}')" class="flex items-center gap-3 hover:text-secondary text-left transition-colors font-medium text-white">
                        <div class="w-8 h-8 rounded-full bg-secondary/15 border border-secondary/30 flex items-center justify-center font-bold text-secondary text-sm">${c.name.charAt(0)}</div>
                        <span class="border-b border-dashed border-white/20 hover:border-secondary">${c.name}</span>
                    </button>
                </td>
                <td class="py-4 text-center text-on-surface-variant">${c.seller}</td>
                <td class="py-4 text-right font-mono font-semibold text-emerald-400">${fmt.format(total)}</td>
            </tr>`;
    }).join('');
}

// ─── Modal: Detalle de cliente ────────────────────────────────────────────────

function showClientDetail(clientName) {
    const client = clientsDb.find(c => c.name === clientName);
    if (!client) return;

    const fmt   = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
    const total = client.sales.reduce((a, b) => a + b, 0);
    const maxV  = Math.max(...client.sales, 1);
    const keys  = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const tipCls = 'absolute -top-9 left-1/2 -translate-x-1/2 text-[10px] font-label-caps text-secondary bg-background border border-white/10 px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30';

    document.getElementById('detail-client-name').innerText       = client.name;
    document.getElementById('detail-client-seller').innerText     = client.seller;
    document.getElementById('detail-total-accumulated').innerText = fmt.format(total);

    document.getElementById('detail-monthly-chart').innerHTML = keys.map((key, idx) => {
        const val  = client.sales[idx];
        const h    = Math.max(5, (val / maxV) * 95);
        const has  = val > 0;
        const bg   = key === selectedMonthCode ? 'bg-secondary' : (has ? 'bg-surface-container-highest/80 hover:bg-secondary/70' : 'bg-white/5');
        return `
            <div class="flex-1 ${bg} rounded-t-sm transition-all group relative cursor-pointer flex flex-col justify-end overflow-visible hover:z-20" style="height:${h}%">
                ${has ? `<div class="${tipCls}">${fmt.format(val)}</div>` : ''}
            </div>`;
    }).join('');

    document.getElementById('search-dropdown').classList.add('hidden');
    document.getElementById('client-search').value = '';
    const modal = document.getElementById('client-detail-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'items-center', 'justify-center');
}

function closeClientDetail() {
    const modal = document.getElementById('client-detail-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex', 'items-center', 'justify-center');
}

// ─── Modal: Top 15 clientes ───────────────────────────────────────────────────

function showTopClients() {
    const modal = document.getElementById('top-clients-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'items-center', 'justify-center');
    const fmt = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

    const sorted = clientsDb
        .map(c => ({ ...c, totalSales: c.sales.reduce((a, b) => a + b, 0) }))
        .sort((a, b) => b.totalSales - a.totalSales);

    document.getElementById('top-clients-table-body').innerHTML = sorted.slice(0, 15).map((c, i) => `
        <tr class="hover:bg-white/5 transition-colors">
            <td class="py-4 text-center font-bold text-secondary">${i + 1}</td>
            <td class="py-4 pl-2">
                <button onclick="showClientDetail('${c.name.replace(/'/g, "\\'")}')" class="hover:text-secondary text-left transition-colors border-b border-dashed border-white/20 hover:border-secondary font-medium text-white">${c.name}</button>
            </td>
            <td class="py-4 text-center text-on-surface-variant">${c.seller}</td>
            <td class="py-4 text-right font-mono text-emerald-400 font-semibold">${fmt.format(c.totalSales)}</td>
        </tr>`).join('');
}

function closeTopClients() {
    const modal = document.getElementById('top-clients-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex', 'items-center', 'justify-center');
}

// ─── Modal: Reporte comparativo ───────────────────────────────────────────────

function swapCompareMonths() {
    const a = document.getElementById('compare-base');
    const b = document.getElementById('compare-target');
    [a.value, b.value] = [b.value, a.value];
}

function generateCrossOverReport() {
    const baseMonth   = document.getElementById('compare-base').value;
    const targetMonth = document.getElementById('compare-target').value;
    const modal       = document.getElementById('crossover-modal');
    const fmt         = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

    modal.classList.remove('hidden');
    modal.classList.add('flex', 'items-center', 'justify-center');
    document.getElementById('co-month-a-label').innerText = monthNamesFull[baseMonth].toUpperCase();
    document.getElementById('co-month-b-label').innerText = monthNamesFull[targetMonth].toUpperCase();

    const iA = months[baseMonth], iB = months[targetMonth];
    let sumA = 0, sumB = 0;
    const inactive = [], activated = [];

    clientsDb.forEach(c => {
        const a = c.sales[iA], b = c.sales[iB];
        sumA += a; sumB += b;
        if (a > 0 && b === 0) inactive.push({ name: c.name, value: a });
        if (b > 0 && a === 0) activated.push({ name: c.name, value: b });
    });

    const delta = sumB - sumA;
    const pos   = delta >= 0;
    document.getElementById('co-val-a').innerText   = fmt.format(sumA);
    document.getElementById('co-val-b').innerText   = fmt.format(sumB);
    document.getElementById('co-delta-val').innerText  = (pos ? '+' : '') + fmt.format(delta);
    document.getElementById('co-delta-perc').innerText = (pos ? '+' : '') + (sumA > 0 ? (delta / sumA * 100).toFixed(1) : '0.0') + '%';
    document.getElementById('co-delta-card').className  = `glass-panel p-6 rounded-xl border-l-4 ${pos ? 'border-emerald-500' : 'border-red-500'}`;
    document.getElementById('co-delta-perc').className  = `text-sm font-semibold px-2 py-0.5 rounded ${pos ? 'text-emerald-400 bg-emerald-950/50' : 'text-red-400 bg-red-950/50'}`;

    const buildRows = (items, cls, badge, emptyMsg) => items.length === 0
        ? `<tr><td colspan="3" class="px-4 py-8 text-center text-slate-500 italic">${emptyMsg}</td></tr>`
        : items.sort((a, b) => b.value - a.value).map(c => `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="px-4 py-3 font-medium text-white">${c.name}</td>
                <td class="px-4 py-3 text-right font-mono ${cls}">${fmt.format(c.value)}</td>
                <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-label-caps ${badge}">${cls.includes('red') ? 'SIN COMPRA' : 'NUEVO'}</span></td>
            </tr>`).join('');

    document.getElementById('co-churn-body').innerHTML = buildRows(inactive,  'text-red-400',    'bg-red-950 text-red-400 border border-red-900/50',     'Ningún cliente quedó inactivo.');
    document.getElementById('co-new-body').innerHTML   = buildRows(activated, 'text-emerald-400','bg-emerald-950 text-emerald-400 border border-emerald-900/50', 'Ningún cliente nuevo activado.');
}

function closeCrossoverModal() {
    const modal = document.getElementById('crossover-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex', 'items-center', 'justify-center');
}

// ─── Buscador en tiempo real ──────────────────────────────────────────────────

const searchInput    = document.getElementById('client-search');
const searchDropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    if (q.length < 2) { searchDropdown.classList.add('hidden'); return; }

    const matches = clientsDb.filter(c => c.name.toLowerCase().includes(q) || c.seller.toLowerCase().includes(q));
    searchDropdown.classList.remove('hidden');

    searchDropdown.innerHTML = matches.length === 0
        ? `<div class="px-4 py-3 text-sm text-on-surface-variant italic text-center">No se encontraron resultados</div>`
        : matches.slice(0, 8).map(c => `
            <div onclick="showClientDetail('${c.name.replace(/'/g, "\\'")}')" class="px-4 py-3 text-sm text-white hover:bg-white/10 hover:text-secondary cursor-pointer transition-colors flex justify-between items-center">
                <span class="font-medium">${c.name}</span>
                <span class="text-xs font-label-caps text-on-surface-variant">${c.seller}</span>
            </div>`).join('');
});

document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) searchDropdown.classList.add('hidden');
    if (selectedMonthCode !== null) {
        const grid = document.getElementById('month-buttons-grid');
        if (grid && !grid.contains(e.target)) selectMonth(null);
    }
});

// ─── Inicialización ───────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    fetchClientsData();
    ['client-detail-modal', 'top-clients-modal', 'crossover-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
    });
});