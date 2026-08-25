/**
 * reporte_de_ventas.js
 * Lógica para el reporte detallado de ventas por vendedor.
 * Obtiene datos desde el servidor Node.js (/api/clientes y /api/vendedores).
 */

// ─── Estado global ────────────────────────────────────────────────────────────
let clientsDb = []; 
let vendorData = {}; 
let selectedVendorForModal = null;
let selectedMonthIdxForModal = null;

const monthKeys = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const fullMonths = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const monthNamesFull = {
    'ENE': 'Enero', 'FEB': 'Febrero', 'MAR': 'Marzo', 'ABR': 'Abril',
    'MAY': 'Mayo', 'JUN': 'Junio', 'JUL': 'Julio', 'AGO': 'Agosto',
    'SEP': 'Septiembre', 'OCT': 'Octubre', 'NOV': 'Noviembre', 'DIC': 'Diciembre'
};

const formatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const formatterShort = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });

// ─── Utilidades ───────────────────────────────────────────────────────────────

function parseSalesValue(valStr) {
    if (!valStr) return 0;
    let clean = String(valStr).replace(/S\/\.?\s?/g, '').replace(/,/g, '').trim();
    let num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

// ─── Carga de datos ───────────────────────────────────────────────────────────

async function fetchClientsData() {
    const loader = document.getElementById('loading-overlay');
    try {
        if (loader) loader.classList.remove('hidden', 'opacity-0');
        
        const [resClients, resVendors] = await Promise.all([
            fetch('/api/clientes'),
            fetch('/api/vendedores')
        ]);
        
        if (!resClients.ok || !resVendors.ok) throw new Error('Error al cargar datos desde la API.');
        
        const dataClients = await resClients.json();
        const dataVendors = await resVendors.json();

        // 1. Procesar Clientes
        const fullToCode = {
            'ENERO': 'ENE', 'FEBRERO': 'FEB', 'MARZO': 'MAR', 'ABRIL': 'ABR',
            'MAYO': 'MAY', 'JUNIO': 'JUN', 'JULIO': 'JUL', 'AGOSTO': 'AGO',
            'SEPTIEMBRE': 'SEP', 'OCTUBRE': 'OCT', 'NOVIEMBRE': 'NOV', 'DICIEMBRE': 'DIC'
        };
        
        clientsDb = dataClients
            .filter(item => item.CLIENTE && item.CLIENTE.trim() !== "")
            .map(item => ({
                name: item.CLIENTE,
                seller: item.VENDEDOR || 'OFICINA',
                sales: fullMonths.map(m => parseSalesValue(item[m])),
                isNewInMonth: fullToCode[(item['C NUEVO'] || '').toString().trim().toUpperCase()] || null
            }));

        // 2. Procesar Vendedores
        vendorData = {};
        dataVendors
            .filter(item => item.VENDEDOR && item.VENDEDOR.trim() !== "")
            .forEach(row => {
                const vendor = row.VENDEDOR.toUpperCase().trim();
                const yearKey = Object.keys(row).find(k => k.startsWith('A') && k.endsWith('O') && k.length === 3) || 'AÑO';
                const rawYear = row[yearKey] || row['AÑO'] || row['AO'];
                const year = rawYear ? String(rawYear).trim() : null;
                
                if (!vendor || !year) return;
                
                if (!vendorData[vendor]) {
                    vendorData[vendor] = { meta: 0, '2025': Array(12).fill(0), '2026': Array(12).fill(0) };
                }
                
                if (row.META && row.META.trim() !== "") {
                    vendorData[vendor].meta = parseSalesValue(row.META);
                }
                
                if (vendorData[vendor][year]) {
                    fullMonths.forEach((m, idx) => {
                        vendorData[vendor][year][idx] = parseSalesValue(row[m]);
                    });
                }
            });

        console.log(`Cargados ${clientsDb.length} clientes y ${Object.keys(vendorData).length} vendedores.`);
        updateVendorCards();

    } catch (err) {
        console.error("Error al cargar datos:", err);
    } finally {
        if (loader) {
            loader.classList.add('opacity-0');
            setTimeout(() => loader.classList.add('hidden'), 500);
        }
    }
}

// ─── Tarjetas de vendedores ───────────────────────────────────────────────────

function updateVendorCards() {
    ['OFICINA', 'ERNESTO', 'ROBERTO', 'REDIPLAST'].forEach(vendor => {
        if (vendorData[vendor]) {
            const total2026 = vendorData[vendor]['2026'].reduce((a, b) => a + b, 0);
            const container = document.getElementById(`sales-total-${vendor}`);
            if (container) container.innerText = formatter.format(total2026);
        }
    });
}

// ─── Modal: Historial por Vendedor ────────────────────────────────────────────

function selectEntity(vendorKey) {
    if (!vendorData[vendorKey]) return;
    
    selectedVendorForModal = vendorKey;
    selectedMonthIdxForModal = null;
    
    document.getElementById('vendor-modal-title').innerHTML = `Historial de Ventas - <span class="text-white">${vendorKey}</span>`;
    
    document.getElementById('vendor-detail-month-title').innerText = "Seleccione un mes";
    document.getElementById('detail-accum-2025').innerText = "S/. 0.00";
    document.getElementById('detail-accum-2026').innerText = "S/. 0.00";
    document.getElementById('detail-comparative-result').innerHTML = '<p class="text-xs text-on-surface-variant">Esperando selección...</p>';
    document.getElementById('meta-results-panel').classList.add('hidden');
    document.getElementById('evaluate-meta-btn').classList.remove('hidden');
    
    renderVendorChart(vendorKey);
    
    const modal = document.getElementById('vendor-history-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'items-center', 'justify-center');
}

function closeVendorHistory() {
    const modal = document.getElementById('vendor-history-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex', 'items-center', 'justify-center');
}

function renderVendorChart(vendorKey) {
    const data2025 = vendorData[vendorKey]['2025'];
    const data2026 = vendorData[vendorKey]['2026'];
    const maxVal = Math.max(...data2025, ...data2026, 1);
    
    const chartContainer = document.getElementById('vendor-monthly-chart');
    chartContainer.innerHTML = '';
    
    monthKeys.forEach((key, idx) => {
        const val2025 = data2025[idx];
        const val2026 = data2026[idx];
        
        const h2025 = Math.max(2, (val2025 / maxVal) * 95);
        const h2026 = Math.max(2, (val2026 / maxVal) * 95);
        
        const groupEl = document.createElement('div');
        groupEl.id = `chart-col-${idx}`;
        groupEl.className = "flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative border-b-2 border-transparent hover:bg-white/5 transition-all pt-2";
        groupEl.onclick = () => selectVendorMonth(idx);
        
        groupEl.innerHTML = `
            <div class="flex-1 flex items-end justify-center gap-0.5 md:gap-1 w-full relative">
                <div class="w-3 md:w-5 bg-white/10 hover:bg-white/20 rounded-t-sm transition-all relative flex flex-col justify-end" style="height: ${h2025}%">
                    <div class="absolute -top-10 left-1/2 -translate-x-1/2 text-[9px] font-label-caps text-slate-300 bg-background px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-white/5 pointer-events-none">
                        2025: ${formatterShort.format(val2025)}
                    </div>
                </div>
                <div class="w-3 md:w-5 bg-secondary hover:bg-secondary/80 rounded-t-sm transition-all relative flex flex-col justify-end" style="height: ${h2026}%">
                    <div class="absolute -top-16 left-1/2 -translate-x-1/2 text-[9px] font-label-caps text-secondary bg-background px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-white/5 font-bold pointer-events-none">
                        2026: ${formatterShort.format(val2026)}
                    </div>
                </div>
            </div>
            <span class="mt-2 text-[10px] text-on-surface-variant font-label-caps">${key}</span>
        `;
        chartContainer.appendChild(groupEl);
    });
}

function selectVendorMonth(idx) {
    selectedMonthIdxForModal = idx;
    const vendorKey = selectedVendorForModal;
    
    // Highlight
    for (let i = 0; i < 12; i++) {
        const el = document.getElementById(`chart-col-${i}`);
        if (el) {
            if (i === idx) {
                el.classList.add('border-secondary', 'bg-white/5');
                el.classList.remove('border-transparent');
            } else {
                el.classList.remove('border-secondary', 'bg-white/5');
                el.classList.add('border-transparent');
            }
        }
    }
    
    document.getElementById('vendor-detail-month-title').innerHTML = `<span class="text-white">Análisis:</span> ${monthNamesFull[monthKeys[idx]].toUpperCase()}`;
    
    const acc2025 = vendorData[vendorKey]['2025'][idx];
    const acc2026 = vendorData[vendorKey]['2026'][idx];
    
    document.getElementById('detail-accum-2025').innerText = formatter.format(acc2025);
    document.getElementById('detail-accum-2026').innerText = formatter.format(acc2026);
    
    const compDiv = document.getElementById('detail-comparative-result');
    if (acc2026 > acc2025 && acc2025 > 0) {
        compDiv.innerHTML = `
            <div class="flex items-center justify-center gap-2 text-emerald-400">
                <span class="text-2xl">😊</span>
                <span class="font-bold text-sm">+ ${formatter.format(acc2026 - acc2025)} superado</span>
            </div>`;
        triggerFireworks();
    } else if (acc2026 < acc2025) {
        compDiv.innerHTML = `
            <div class="flex items-center justify-center gap-2 text-red-400">
                <span class="text-2xl">😢</span>
                <span class="font-bold text-sm">- ${formatter.format(acc2025 - acc2026)} por debajo</span>
            </div>`;
    } else {
        compDiv.innerHTML = `<span class="text-sm text-slate-300 font-bold">Igualado al año anterior o sin comparativa</span>`;
    }
    
    document.getElementById('evaluate-meta-btn').classList.remove('hidden');
    document.getElementById('meta-results-panel').classList.add('hidden');
}

// ─── Evaluación de Meta y Efectos ─────────────────────────────────────────────

function evaluarMetaMes() {
    if (selectedMonthIdxForModal === null || !selectedVendorForModal) return;
    
    const vendorKey = selectedVendorForModal;
    const monthlySales = vendorData[vendorKey]['2026'][selectedMonthIdxForModal];
    const meta = vendorData[vendorKey]['meta'];
    
    document.getElementById('detail-meta-target').innerText = formatter.format(meta);
    document.getElementById('detail-meta-month').innerText = formatter.format(monthlySales);
    
    const pct = meta > 0 ? (monthlySales / meta) * 100 : 0;
    const statusDiv = document.getElementById('meta-final-status');
    
    if (pct < 70) {
        statusDiv.innerHTML = `<span class="text-3xl">😢</span><div class="text-left"><span class="block text-red-400 font-bold text-lg">${pct.toFixed(1)}%</span><span class="text-[9px] text-on-surface-variant uppercase">Bajo rendimiento</span></div>`;
    } else if (pct >= 70 && pct < 90) {
        statusDiv.innerHTML = `<span class="text-3xl">🙂</span><div class="text-left"><span class="block text-yellow-400 font-bold text-lg">${pct.toFixed(1)}%</span><span class="text-[9px] text-on-surface-variant uppercase">Casi en la meta</span></div>`;
    } else if (pct >= 90 && pct < 100) {
        statusDiv.innerHTML = `<span class="text-3xl">😊</span><div class="text-left"><span class="block text-emerald-400 font-bold text-lg">${pct.toFixed(1)}%</span><span class="text-[9px] text-on-surface-variant uppercase">Buen trabajo</span></div>`;
    } else {
        statusDiv.innerHTML = `<span class="text-3xl">🤩</span><div class="text-left"><span class="block text-secondary font-bold text-lg">${pct.toFixed(1)}%</span><span class="text-[9px] text-on-surface-variant uppercase">¡Meta Cumplida! 🎉</span></div>`;
        triggerFireworks();
    }
    
    document.getElementById('evaluate-meta-btn').classList.add('hidden');
    document.getElementById('meta-results-panel').classList.remove('hidden');
}

function triggerFireworks() {
    if (typeof confetti === 'function') {
        const end = Date.now() + 2000;
        (function frame() {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#e9c349', '#ffffff'] });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#e9c349', '#ffffff'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }
}

// ─── Modal: Clientes Nuevos ───────────────────────────────────────────────────

function openEntityNewClients(entityKey) {
    if (entityKey === 'REDIPLAST') return; // REDIPLAST no muestra este modal

    const modal = document.getElementById('entity-new-clients-modal');
    const tbody = document.getElementById('entity-new-clients-table-body');
    
    document.getElementById('entity-new-clients-title').innerText = `Clientes Nuevos 2026 - ${entityKey.toUpperCase()}`;
    modal.classList.remove('hidden');

    const filtered = clientsDb.filter(c => c.seller === entityKey && c.isNewInMonth !== null);
    const monthOrder = { 'ENE':1,'FEB':2,'MAR':3,'ABR':4,'MAY':5,'JUN':6,'JUL':7,'AGO':8,'SEP':9,'OCT':10,'NOV':11,'DIC':12 };
    
    filtered.sort((a, b) => monthOrder[a.isNewInMonth] - monthOrder[b.isNewInMonth]);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-on-surface-variant italic">No se registraron nuevos clientes para ${entityKey.toUpperCase()} en 2026.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(c => {
        const totalSales = c.sales.reduce((acc, curr) => acc + curr, 0);
        return `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="py-4 pl-2">
                    <button onclick="showClientDetail('${c.name.replace(/'/g, "\\'")}')" class="flex items-center gap-3 hover:text-secondary text-left transition-colors font-medium text-white">
                        <div class="w-8 h-8 rounded-full bg-secondary/15 border border-secondary/30 flex items-center justify-center font-bold text-secondary text-sm">${c.name.charAt(0)}</div>
                        <span class="border-b border-dashed border-white/20 hover:border-secondary">${c.name}</span>
                    </button>
                </td>
                <td class="py-4 text-center text-on-surface-variant font-semibold">${monthNamesFull[c.isNewInMonth]}</td>
                <td class="py-4 text-right font-mono font-semibold text-emerald-400">${formatter.format(totalSales)}</td>
            </tr>`;
    }).join('');
}

function closeEntityNewClients() {
    const modal = document.getElementById('entity-new-clients-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex', 'items-center', 'justify-center');
}

// ─── Modal: Detalle de Cliente ────────────────────────────────────────────────

function showClientDetail(clientName) {
    const client = clientsDb.find(c => c.name === clientName);
    if (!client) return;

    document.getElementById('detail-client-name').innerText = client.name;
    document.getElementById('detail-client-seller').innerText = client.seller;

    const totalAccumulated = client.sales.reduce((acc, curr) => acc + curr, 0);
    document.getElementById('detail-total-accumulated').innerText = formatter.format(totalAccumulated);

    const maxVal = Math.max(...client.sales, 1);
    
    document.getElementById('detail-monthly-chart').innerHTML = monthKeys.map((key, idx) => {
        const val = client.sales[idx];
        const heightPct = Math.max(5, (val / maxVal) * 95);
        const hasBought = val > 0;
        
        return `
            <div class="flex-1 ${hasBought ? 'bg-secondary' : 'bg-white/5'} rounded-t-sm transition-all group relative cursor-pointer flex flex-col justify-end overflow-visible hover:z-20" style="height: ${heightPct}%">
                ${hasBought ? `<div class="absolute -top-9 left-1/2 -translate-x-1/2 text-[9px] font-label-caps text-secondary bg-background border border-white/10 px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">${formatter.format(val)}</div>` : ''}
            </div>`;
    }).join('');

    const modal = document.getElementById('client-detail-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'items-center', 'justify-center');
}

function closeClientDetail() {
    const modal = document.getElementById('client-detail-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex', 'items-center', 'justify-center');
}

// ─── Inicialización ───────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    fetchClientsData();
});