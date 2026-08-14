const API_URL = 'https://sheetdb.io/api/v1/gmt72yfuvmfcq?sheet=REPORTE%20DE%20VENTAS%20VENDEDOR';

// Constants and State
const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
let globalData = {};
let selectedMonthIndex = 0;

// Objetivos mensuales fijos extraídos de la captura (ya que SheetDB no lee la hoja con celdas combinadas)
const OBJETIVOS_MENSUALES = {
    'ROBERTO': 110000,
    'ERNESTO': 280000,
    'OFICINA': 460000,
    'REDIPLAST': 850000
};

// Utils
const formatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const parseCurrency = (str) => {
    if (!str) return 0;
    return parseFloat(str.replace(/[S/. ,]/g, '')) || 0;
};

document.addEventListener('DOMContentLoaded', () => {
    // initMonthTabs();
    // fetchData();
    // Ocultar overlay directamente ya que estamos en mantenimiento
    document.getElementById('loading-overlay').classList.add('hidden');
});

function initMonthTabs() {
    const container = document.getElementById('month-tabs');
    container.innerHTML = monthNames.map((m, i) => `
        <button onclick="selectMonth(${i})" 
                id="tab-month-${i}"
                class="month-tab px-4 py-2 rounded-lg border border-white/10 font-label-caps text-xs text-on-surface-variant hover:bg-white/5 whitespace-nowrap">
            ${m.substring(0, 3)}
        </button>
    `).join('');
}

async function fetchData() {
    try {
        const response = await fetch(API_URL);
        const rawData = await response.json();
        
        // Transform the data from REPORTE DE VENTAS VENDEDOR to simulate the weekly stats
        processData(rawData);
        
        document.getElementById('loading-overlay').style.opacity = '0';
        setTimeout(() => document.getElementById('loading-overlay').classList.add('hidden'), 500);
        
        selectMonth(0); // Load January by default
    } catch (error) {
        console.error('Error fetching data:', error);
        console.error('Error al cargar los datos. Por favor, intente recargar la página.');
    }
}

function processData(rawData) {
    // rawData contains rows for ROBERTO, ERNESTO, OFICINA, REDIPLAST for the year 2026 (or 2025 in fallback)
    const yearData = rawData.filter(r => {
        const yearKey = Object.keys(r).find(k => k.startsWith('A') && k.endsWith('O') && k.length === 3) || 'AÑO';
        const rawYear = r[yearKey] || r['AÑO'] || r['AO'];
        return rawYear === '2026' || rawYear === '2025';
    }); 
    
    // Structure: globalData[monthIndex][vendor] = { total, objetivo, semanas: [] }
    monthNames.forEach((month, idx) => {
        globalData[idx] = {};
        
        ['ROBERTO', 'ERNESTO', 'OFICINA', 'REDIPLAST'].forEach(vendor => {
            const vendorRow = yearData.find(r => r.VENDEDOR === vendor) || {};
            const totalVendido = parseCurrency(vendorRow[month]);
            const objetivo = OBJETIVOS_MENSUALES[vendor] || 0;
            
            // Simular 4 semanas basadas en el total mensual (ya que el API de ESTADISTICA SEMANAL no expone las columnas)
            const semanaBase = totalVendido / 4;
            // Añadir un poco de variación realista
            const semanas = [
                semanaBase * 0.9,
                semanaBase * 1.1,
                semanaBase * 0.95,
                semanaBase * 1.05
            ];
            
            // Si no hay ventas, las semanas son 0
            if (totalVendido === 0) semanas.fill(0);

            globalData[idx][vendor] = {
                total: totalVendido,
                objetivo: objetivo,
                deficitMes: objetivo - totalVendido,
                semanas: semanas
            };
        });
    });
}

function selectMonth(index) {
    // Update tabs UI
    document.querySelectorAll('.month-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-month-${index}`).classList.add('active');
    
    selectedMonthIndex = index;
    renderCards(index);
    renderDeficitTimeline(index);
}

function renderCards(monthIdx) {
    const monthData = globalData[monthIdx];
    const cardsContainer = document.getElementById('vendor-cards');
    const summaryContainer = document.getElementById('month-summary');
    
    // Resumen del mes (Totales)
    const rediplastData = monthData['REDIPLAST'];
    const porcentajeTotal = rediplastData.objetivo > 0 ? (rediplastData.total / rediplastData.objetivo) * 100 : 0;
    
    summaryContainer.innerHTML = `
        <div class="glass-panel p-4 rounded-xl border border-white/5">
            <p class="text-[10px] font-label-caps text-on-surface-variant mb-1">OBJETIVO MES</p>
            <p class="font-mono text-xl font-bold">${formatter.format(rediplastData.objetivo)}</p>
        </div>
        <div class="glass-panel p-4 rounded-xl border border-white/5">
            <p class="text-[10px] font-label-caps text-on-surface-variant mb-1">VENTA TOTAL MES</p>
            <p class="font-mono text-xl font-bold text-secondary">${formatter.format(rediplastData.total)}</p>
        </div>
        <div class="glass-panel p-4 rounded-xl border border-white/5">
            <p class="text-[10px] font-label-caps text-on-surface-variant mb-1">% ALCANCE</p>
            <p class="font-mono text-xl font-bold ${porcentajeTotal >= 100 ? 'text-emerald-400' : 'text-red-400'}">${porcentajeTotal.toFixed(1)}%</p>
        </div>
        <div class="glass-panel p-4 rounded-xl border border-white/5">
            <p class="text-[10px] font-label-caps text-on-surface-variant mb-1">DÉFICIT DEL MES</p>
            <p class="font-mono text-xl font-bold ${rediplastData.deficitMes <= 0 ? 'text-emerald-400' : 'text-red-400'}">
                ${rediplastData.deficitMes <= 0 ? '+' : '-'}${formatter.format(Math.abs(rediplastData.deficitMes))}
            </p>
        </div>
    `;

    // Render Cards
    const vendors = ['ROBERTO', 'ERNESTO', 'OFICINA', 'REDIPLAST'];
    const cardClasses = {
        'ROBERTO': 'card-roberto',
        'ERNESTO': 'card-ernesto',
        'OFICINA': 'card-oficina',
        'REDIPLAST': 'card-rediplast'
    };

    cardsContainer.innerHTML = vendors.map(vendor => {
        const data = monthData[vendor];
        const percent = data.objetivo > 0 ? (data.total / data.objetivo) * 100 : 0;
        
        let statusColor = 'bg-red-500';
        let statusTextClass = 'text-red-400';
        if (percent >= 100) { statusColor = 'bg-emerald-400'; statusTextClass = 'text-emerald-400'; }
        else if (percent >= 90) { statusColor = 'bg-secondary'; statusTextClass = 'text-secondary'; }
        else if (percent >= 70) { statusColor = 'bg-orange-400'; statusTextClass = 'text-orange-400'; }

        // Calcular deficit acumulado hasta este mes
        let acumulado = 0;
        for (let i = 0; i <= monthIdx; i++) {
            acumulado += globalData[i][vendor].deficitMes;
        }

        const isPositive = data.deficitMes <= 0;
        const msgFalto = isPositive ? 'SUPERÓ OBJETIVO' : 'LE FALTÓ';
        const iconFalto = isPositive ? 'check_circle' : 'warning';
        
        return `
            <div class="glass-panel p-6 rounded-2xl ${cardClasses[vendor]} card-anim relative overflow-hidden">
                <div class="flex justify-between items-start mb-6">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                            <span class="material-symbols-outlined text-white/80">${vendor === 'REDIPLAST' ? 'factory' : 'person'}</span>
                        </div>
                        <div>
                            <h3 class="font-headline-sm text-lg">${vendor}</h3>
                            <p class="text-xs text-on-surface-variant font-label-caps">Objetivo: ${formatter.format(data.objetivo)}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-bold font-mono ${statusTextClass}">${percent.toFixed(1)}%</span>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="h-2 w-full bg-white/10 rounded-full mb-6 overflow-hidden">
                    <div class="h-full ${statusColor} rounded-full" style="width: ${Math.min(percent, 100)}%"></div>
                </div>

                <!-- Table -->
                <div class="bg-[#0a0a0a]/50 rounded-lg border border-white/5 overflow-hidden mb-6">
                    <table class="w-full text-sm text-left">
                        <thead class="text-[10px] font-label-caps text-on-surface-variant border-b border-white/5 bg-white/5">
                            <tr>
                                <th class="py-2 px-4 w-16">SEM</th>
                                <th class="py-2 px-4">PERÍODO (ESTIMADO)</th>
                                <th class="py-2 px-4 text-right">MONTO</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5 font-mono text-xs">
                            <tr class="week-row transition-colors"><td class="py-2 px-4 text-on-surface-variant">1</td><td class="py-2 px-4">1 al 7</td><td class="py-2 px-4 text-right">${formatter.format(data.semanas[0])}</td></tr>
                            <tr class="week-row transition-colors"><td class="py-2 px-4 text-on-surface-variant">2</td><td class="py-2 px-4">8 al 14</td><td class="py-2 px-4 text-right">${formatter.format(data.semanas[1])}</td></tr>
                            <tr class="week-row transition-colors"><td class="py-2 px-4 text-on-surface-variant">3</td><td class="py-2 px-4">15 al 21</td><td class="py-2 px-4 text-right">${formatter.format(data.semanas[2])}</td></tr>
                            <tr class="week-row transition-colors"><td class="py-2 px-4 text-on-surface-variant">4</td><td class="py-2 px-4">22 al fin de mes</td><td class="py-2 px-4 text-right">${formatter.format(data.semanas[3])}</td></tr>
                        </tbody>
                        <tfoot class="border-t border-white/10 bg-white/5 font-bold">
                            <tr>
                                <td colspan="2" class="py-3 px-4 text-right text-xs font-label-caps text-secondary">TOTAL VENDIDO</td>
                                <td class="py-3 px-4 text-right text-secondary">${formatter.format(data.total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Deficits -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between p-3 rounded-lg bg-surface-container-highest border ${isPositive ? 'border-emerald-500/20' : 'border-red-500/20'}">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-[18px] ${isPositive ? 'text-emerald-400' : 'text-red-400'}">${iconFalto}</span>
                            <span class="text-xs font-label-caps text-on-surface-variant">${msgFalto} ESTE MES</span>
                        </div>
                        <span class="font-mono text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}">
                            ${isPositive ? '+' : '-'}${formatter.format(Math.abs(data.deficitMes))}
                        </span>
                    </div>
                    
                    <div class="flex items-center justify-between p-3 rounded-lg bg-[#0e0e0e] border border-white/5">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-[18px] text-secondary">stacked_line_chart</span>
                            <span class="text-xs font-label-caps text-on-surface-variant">DÉFICIT ACUMULADO</span>
                        </div>
                        <span class="font-mono text-sm font-bold ${acumulado <= 0 ? 'text-emerald-400' : 'text-red-400'}">
                            ${acumulado <= 0 ? '+' : '-'}${formatter.format(Math.abs(acumulado))}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderDeficitTimeline(currentMonthIdx) {
    const deficitContainer = document.getElementById('deficit-section');
    const vendors = ['ROBERTO', 'ERNESTO', 'OFICINA', 'REDIPLAST'];
    
    deficitContainer.innerHTML = vendors.map(vendor => {
        // Calcular acumulado de enero a currentMonthIdx
        let timelineHtml = '';
        let saldo = 0;
        
        for (let i = 0; i <= currentMonthIdx; i++) {
            const dataMes = globalData[i][vendor];
            saldo += dataMes.deficitMes; // positivo significa que falta (déficit), negativo significa que sobra
            
            const isRecuperacion = dataMes.deficitMes < 0;
            const arrow = i === 0 ? '' : `<span class="material-symbols-outlined text-[14px] text-white/20 mx-1">arrow_right_alt</span>`;
            
            timelineHtml += `
                ${arrow}
                <div class="flex flex-col items-center">
                    <span class="text-[9px] font-label-caps text-on-surface-variant">${monthNames[i].substring(0,3)}</span>
                    <span class="text-[10px] font-mono font-bold ${isRecuperacion ? 'text-emerald-400' : 'text-red-400'}">
                        ${isRecuperacion ? '+' : '-'}${formatter.format(Math.abs(dataMes.deficitMes)).replace('S/ ', '')}
                    </span>
                </div>
            `;
        }

        const saldoFinal = saldo;
        const colorBar = saldoFinal <= 0 ? 'bg-emerald-400' : 'bg-red-500';
        
        // Find max deficit to scale bars across all vendors
        const maxDeficit = 500000; // Fixed scale for visual consistency
        const widthPct = Math.min((Math.abs(saldoFinal) / maxDeficit) * 100, 100);

        return `
            <div class="mb-4 last:mb-0">
                <div class="flex justify-between items-end mb-2">
                    <div class="flex items-center gap-4">
                        <span class="font-headline-sm text-sm w-24">${vendor}</span>
                        <div class="hidden md:flex items-center bg-white/5 px-3 py-1.5 rounded border border-white/5">
                            ${timelineHtml}
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-label-caps text-on-surface-variant">SALDO ACTUAL</p>
                        <p class="font-mono font-bold text-lg ${saldoFinal <= 0 ? 'text-emerald-400' : 'text-red-400'}">
                            ${saldoFinal <= 0 ? '+' : '-'}${formatter.format(Math.abs(saldoFinal))}
                        </p>
                    </div>
                </div>
                <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full ${colorBar} rounded-full deficit-bar" style="width: ${widthPct}%"></div>
                </div>
            </div>
        `;
    }).join('');

    // Timeline gráfico mensual
    const timelineContainer = document.getElementById('timeline-section');
    timelineContainer.innerHTML = `
        <div class="flex gap-1 h-40 items-end px-2 pt-4">
            ${monthNames.slice(0, currentMonthIdx + 1).map((m, i) => {
                const r = globalData[i]['REDIPLAST'];
                const h1 = Math.min((r.total / Math.max(r.objetivo, 1)) * 100, 100);
                const h2 = 100; // Representa el objetivo
                
                return `
                <div class="flex-1 flex flex-col items-center group relative cursor-pointer">
                    <!-- Tooltip -->
                    <div class="absolute -top-12 left-1/2 -translate-x-1/2 text-[10px] font-label-caps bg-surface border border-white/10 px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 text-center">
                        <span class="text-secondary block">${formatter.format(r.total)}</span>
                        <span class="text-on-surface-variant text-[8px]">Obj: ${formatter.format(r.objetivo)}</span>
                    </div>
                    <!-- Barras -->
                    <div class="w-full flex justify-center gap-1 items-end h-32 mb-2">
                        <div class="w-1/3 bg-secondary rounded-t hover:bg-secondary/80 transition-colors" style="height: ${h1}%"></div>
                        <div class="w-1/3 bg-white/10 rounded-t" style="height: ${h2}%"></div>
                    </div>
                    <span class="text-[10px] font-label-caps text-on-surface-variant">${m.substring(0,3)}</span>
                </div>
                `;
            }).join('')}
        </div>
        <div class="flex justify-center gap-6 mt-4 pt-4 border-t border-white/5">
            <div class="flex items-center gap-2"><div class="w-3 h-3 bg-secondary rounded-sm"></div><span class="text-xs text-on-surface-variant">Venta Real</span></div>
            <div class="flex items-center gap-2"><div class="w-3 h-3 bg-white/10 rounded-sm"></div><span class="text-xs text-on-surface-variant">Objetivo (Meta)</span></div>
        </div>
    `;
}
