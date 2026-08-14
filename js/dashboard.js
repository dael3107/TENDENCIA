// Dynamic database connected to SheetDB API
const API_URL = 'https://sheetdb.io/api/v1/gmt72yfuvmfcq';
let clientsDb = [];

// Month indexing mapper
const months = {
    'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11
};
const monthNamesFull = {
    'ENE': 'Enero', 'FEB': 'Febrero', 'MAR': 'Marzo', 'ABR': 'Abril',
    'MAY': 'Mayo', 'JUN': 'Junio', 'JUL': 'Julio', 'AGO': 'Agosto',
    'SEP': 'Septiembre', 'OCT': 'Octubre', 'NOV': 'Noviembre', 'DIC': 'Diciembre'
};

// Active state
let selectedMonthCode = null;

// Utility to parse SheetDB currency values e.g. "S/.12,319.72" or "-S/.4.00" or ""
function parseSalesValue(valStr) {
    if (!valStr) return 0;
    // Remove currency prefix, commas, and trim whitespace
    let clean = valStr.replace(/S\/\.?\s?/g, '').replace(/,/g, '').trim();
    let num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

// Fetch clients data from SheetDB on load
async function fetchClientsData() {
    const loader = document.getElementById('loading-overlay');
    try {
        if (loader) {
            loader.classList.remove('hidden', 'opacity-0');
        }
        
        const response = await fetch(API_URL);
        const data = await response.json();
        
        // Map keys to match dashboard formats
        const fullToCode = {
            'ENERO': 'ENE', 'FEBRERO': 'FEB', 'MARZO': 'MAR', 'ABRIL': 'ABR',
            'MAYO': 'MAY', 'JUNIO': 'JUN', 'JULIO': 'JUL', 'AGOSTO': 'AGO',
            'SEPTIEMBRE': 'SEP', 'OCTUBRE': 'OCT', 'NOVIEMBRE': 'NOV', 'DICIEMBRE': 'DIC'
        };
        
        // Exclude total rows and blank client rows (i.e. CLIENTE field is empty)
        const cleanData = data.filter(item => item.CLIENTE && item.CLIENTE.trim() !== "");
        
        clientsDb = cleanData.map(item => {
            const sales = [
                parseSalesValue(item.ENERO),
                parseSalesValue(item.FEBRERO),
                parseSalesValue(item.MARZO),
                parseSalesValue(item.ABRIL),
                parseSalesValue(item.MAYO),
                parseSalesValue(item.JUNIO),
                parseSalesValue(item.JULIO),
                parseSalesValue(item.AGOSTO),
                parseSalesValue(item.SEPTIEMBRE),
                parseSalesValue(item.OCTUBRE),
                parseSalesValue(item.NOVIEMBRE),
                parseSalesValue(item.DICIEMBRE)
            ];
            
            const rawNew = (item['C NUEVO'] || '').trim().toUpperCase();
            const isNewInMonth = fullToCode[rawNew] || null;

            return {
                name: item.CLIENTE,
                seller: item.VENDEDOR || 'OFICINA',
                sales: sales,
                isNewInMonth: isNewInMonth
            };
        });
        
        console.log(`Loaded ${clientsDb.length} records successfully from SheetDB.`);
        
        // Refresh dashboard displays
        selectMonth(selectedMonthCode);
        updateBarChart();
    } catch (err) {
        console.error("Error loading data from SheetDB:", err);
        console.error("Error al cargar datos de SheetDB:", err);
    } finally {
        if (loader) {
            loader.classList.add('opacity-0');
            setTimeout(() => {
                loader.classList.add('hidden');
            }, 500);
        }
    }
}

// Selects a month on the dashboard, updates indicators
function selectMonth(monthCode) {
    selectedMonthCode = monthCode;
    
    // Update title and badge visibility
    const titleEl = document.getElementById('selected-month-title');
    const countEl = document.getElementById('new-clients-count');
    if (monthCode) {
        titleEl.innerText = `${monthNamesFull[monthCode]} 2026`;
        countEl.style.display = '';
    } else {
        titleEl.innerText = '— Selecciona un mes';
        countEl.style.display = 'none';
    }
    
    // Reset active styles on month buttons
    Object.keys(months).forEach(code => {
        const btn = document.getElementById(`btn-month-${code}`);
        if (btn) {
            if (code === monthCode) {
                btn.className = "group glass-panel p-6 rounded-xl border border-secondary transition-all text-center bg-secondary/10";
                const labelCaps = btn.querySelector('.font-label-caps');
                if (labelCaps) labelCaps.className = "font-label-caps text-[12px] text-secondary mb-2";
                const headline = btn.querySelector('.font-headline-sm');
                if (headline) headline.className = "font-headline-sm scale-110 text-secondary transition-transform";
            } else {
                btn.className = "group glass-panel p-6 rounded-xl border border-transparent hover:border-secondary/30 transition-all text-center";
                const labelCaps = btn.querySelector('.font-label-caps');
                if (labelCaps) labelCaps.className = "font-label-caps text-[12px] text-on-surface-variant group-hover:text-secondary mb-2";
                const headline = btn.querySelector('.font-headline-sm');
                if (headline) headline.className = "font-headline-sm group-hover:scale-110 transition-transform text-white";
            }
        }
    });

    // Update New Clients Table
    renderNewClients(monthCode);
    
    // Refresh chart to update active highlighting
    updateBarChart();
}

// Updates heights and values of the bar chart dynamically
function updateBarChart() {
    const monthlyTotals = {
        'ENE': 0, 'FEB': 0, 'MAR': 0, 'ABR': 0, 'MAY': 0, 'JUN': 0,
        'JUL': 0, 'AGO': 0, 'SEP': 0, 'OCT': 0, 'NOV': 0, 'DIC': 0
    };

    clientsDb.forEach(c => {
        monthlyTotals['ENE'] += c.sales[0];
        monthlyTotals['FEB'] += c.sales[1];
        monthlyTotals['MAR'] += c.sales[2];
        monthlyTotals['ABR'] += c.sales[3];
        monthlyTotals['MAY'] += c.sales[4];
        monthlyTotals['JUN'] += c.sales[5];
        monthlyTotals['JUL'] += c.sales[6];
        monthlyTotals['AGO'] += c.sales[7];
        monthlyTotals['SEP'] += c.sales[8];
        monthlyTotals['OCT'] += c.sales[9];
        monthlyTotals['NOV'] += c.sales[10];
        monthlyTotals['DIC'] += c.sales[11];
    });

    const maxTotal = Math.max(...Object.values(monthlyTotals), 1);
    const formatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });

    Object.keys(monthlyTotals).forEach(code => {
        const barDiv = document.getElementById(`bar-${code}`);
        if (barDiv) {
            const total = monthlyTotals[code];
            const heightPct = Math.max(5, (total / maxTotal) * 95);
            
            barDiv.style.height = `${heightPct}%`;
            
            const tooltip = barDiv.querySelector('.tooltip-val');
            if (tooltip) {
                tooltip.innerText = formatter.format(total);
            }
            
            const hasSales = total > 0;
            
            // All months with sales are styled in gold (bg-secondary) uniformly
            const barBgClass = hasSales 
                ? "flex-1 bg-secondary rounded-t-sm hover:scale-x-105 transition-all group relative cursor-pointer flex flex-col justify-end"
                : "flex-1 bg-surface-container-highest/30 rounded-t-sm transition-all group relative flex flex-col justify-end";
                
            barDiv.className = barBgClass;

            if (tooltip) {
                if (hasSales) {
                    // Tooltip is always visible for months with actual sales
                    tooltip.className = "tooltip-val absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-label-caps text-secondary bg-background px-1.5 py-0.5 rounded shadow font-bold opacity-100";
                } else {
                    // Hide tooltip if no sales recorded
                    tooltip.className = "tooltip-val absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-label-caps text-on-surface-variant opacity-0 bg-background px-1.5 py-0.5 rounded shadow";
                }
            }
        }
    });
}

// Render new clients for a given month with their total accumulated purchases
function renderNewClients(monthCode) {
    const tbody = document.getElementById('new-clients-table-body');

    // No month selected – show prompt
    if (!monthCode) {
        document.getElementById('new-clients-count').style.display = 'none';
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="py-8 text-center text-on-surface-variant italic">
                    Selecciona un mes para ver los clientes nuevos.
                </td>
            </tr>
        `;
        return;
    }

    const newClients = clientsDb.filter(c => c.isNewInMonth === monthCode);
    
    document.getElementById('new-clients-count').innerText = `${newClients.length} ${newClients.length === 1 ? 'CLIENTE NUEVO' : 'CLIENTES NUEVOS'}`;

    if (newClients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="py-8 text-center text-on-surface-variant italic">
                    No se registraron nuevos clientes en el mes de ${monthNamesFull[monthCode]}.
                </td>
            </tr>
        `;
        return;
    }

    const formatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

    tbody.innerHTML = newClients.map(c => {
        const initial = c.name.charAt(0);
        
        // Sum total accumulated purchases (ENE-DIC)
        const totalPurchases = c.sales.reduce((acc, val) => acc + val, 0);
        
        return `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="py-4 pl-2">
                    <button onclick="showClientDetail('${c.name.replace(/'/g, "\'")}')" class="flex items-center gap-3 hover:text-secondary text-left transition-colors font-medium text-white">
                        <div class="w-8 h-8 rounded-full bg-secondary/15 border border-secondary/30 flex items-center justify-center font-bold text-secondary text-sm">
                            ${initial}
                        </div>
                        <span class="border-b border-dashed border-white/20 hover:border-secondary">${c.name}</span>
                    </button>
                </td>
                <td class="py-4 text-center text-on-surface-variant">${c.seller}</td>
                <td class="py-4 text-right font-mono font-semibold text-emerald-400">${formatter.format(totalPurchases)}</td>
            </tr>
        `;
    }).join('');
}

// Show Client Detail Floating Modal (Historial / Tendencia as a Bar Chart)
function showClientDetail(clientName) {
    const client = clientsDb.find(c => c.name === clientName);
    if (!client) return;

    document.getElementById('detail-client-name').innerText = client.name;
    document.getElementById('detail-client-seller').innerText = client.seller;

    const formatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
    const totalAccumulated = client.sales.reduce((acc, curr) => acc + curr, 0);
    document.getElementById('detail-total-accumulated').innerText = formatter.format(totalAccumulated);

    const maxVal = Math.max(...client.sales, 1);
    const monthKeys = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const chartContainer = document.getElementById('detail-monthly-chart');

    chartContainer.innerHTML = monthKeys.map((key, idx) => {
        const val = client.sales[idx];
        const heightPct = Math.max(5, (val / maxVal) * 95);
        const hasBought = val > 0;
        
        const isActive = key === selectedMonthCode;
        const barBg = isActive 
            ? "bg-secondary" 
            : (hasBought ? "bg-surface-container-highest/80 hover:bg-secondary/70" : "bg-white/5");

        // Tooltip solo visible en hover, siempre adelante con z-30
        const tooltipClass = "absolute -top-9 left-1/2 -translate-x-1/2 text-[10px] font-label-caps text-secondary bg-background border border-white/10 px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30";

        return `
            <div class="flex-1 ${barBg} rounded-t-sm transition-all group relative cursor-pointer flex flex-col justify-end overflow-visible hover:z-20" style="height: ${heightPct}%">
                ${hasBought ? `<div class="${tooltipClass}">${formatter.format(val)}</div>` : ''}
            </div>
        `;
    }).join('');

    // Hide search dropdown if open
    document.getElementById('search-dropdown').classList.add('hidden');
    document.getElementById('client-search').value = '';

    document.getElementById('client-detail-modal').classList.remove('hidden');
    document.getElementById('client-detail-modal').classList.add('flex', 'items-center', 'justify-center');
}

function closeClientDetail() {
    document.getElementById('client-detail-modal').classList.add('hidden');
    document.getElementById('client-detail-modal').classList.remove('flex', 'items-center', 'justify-center');
}

// Show Top 15 Clients Modal (Summing total ENE-DIC and removing comparison)
function showTopClients() {
    const modal = document.getElementById('top-clients-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'items-center', 'justify-center');

    const tbody = document.getElementById('top-clients-table-body');

    const sortedClients = clientsDb.map(c => {
        const total = c.sales.reduce((acc, curr) => acc + curr, 0);
        return { ...c, totalSales: total };
    }).sort((a, b) => b.totalSales - a.totalSales);

    const formatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

    tbody.innerHTML = sortedClients.slice(0, 15).map((c, idx) => {
        return `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="py-4 text-center font-bold text-secondary">${idx + 1}</td>
                <td class="py-4 pl-2">
                    <button onclick="showClientDetail('${c.name.replace(/'/g, "\'")}')" class="hover:text-secondary text-left transition-colors border-b border-dashed border-white/20 hover:border-secondary font-medium text-white">
                        ${c.name}
                    </button>
                </td>
                <td class="py-4 text-center text-on-surface-variant">${c.seller}</td>
                <td class="py-4 text-right font-mono text-emerald-400 font-semibold">${formatter.format(c.totalSales)}</td>
            </tr>
        `;
    }).join('');
}

function closeTopClients() {
    document.getElementById('top-clients-modal').classList.add('hidden');
    document.getElementById('top-clients-modal').classList.remove('flex', 'items-center', 'justify-center');
}

// Swap months helper
function swapCompareMonths() {
    const baseSelect = document.getElementById('compare-base');
    const targetSelect = document.getElementById('compare-target');
    const baseVal = baseSelect.value;
    baseSelect.value = targetSelect.value;
    targetSelect.value = baseVal;
}

// Generate Cross-Over Transition Report
function generateCrossOverReport() {
    const modal = document.getElementById('crossover-modal');
    const baseMonth = document.getElementById('compare-base').value;
    const targetMonth = document.getElementById('compare-target').value;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex', 'items-center', 'justify-center');

    document.getElementById('co-month-a-label').innerText = monthNamesFull[baseMonth].toUpperCase();
    document.getElementById('co-month-b-label').innerText = monthNamesFull[targetMonth].toUpperCase();

    const indexA = months[baseMonth];
    const indexB = months[targetMonth];

    let sumA = 0;
    let sumB = 0;
    
    const inactiveClients = [];
    const activatedClients = [];

    clientsDb.forEach(c => {
        const valA = c.sales[indexA];
        const valB = c.sales[indexB];

        sumA += valA;
        sumB += valB;

        if (valA > 0 && valB === 0) {
            inactiveClients.push({ name: c.name, value: valA });
        }
        if (valB > 0 && valA === 0) {
            activatedClients.push({ name: c.name, value: valB });
        }
    });

    const formatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
    
    document.getElementById('co-val-a').innerText = formatter.format(sumA);
    document.getElementById('co-val-b').innerText = formatter.format(sumB);

    const delta = sumB - sumA;
    const deltaPerc = sumA > 0 ? (delta / sumA * 100).toFixed(1) : '0.0';

    const deltaValContainer = document.getElementById('co-delta-val');
    const deltaPercContainer = document.getElementById('co-delta-perc');
    const deltaCard = document.getElementById('co-delta-card');

    deltaValContainer.innerText = (delta >= 0 ? '+' : '') + formatter.format(delta);
    deltaPercContainer.innerText = (delta >= 0 ? '+' : '') + deltaPerc + '%';

    if (delta >= 0) {
        deltaCard.className = "glass-panel p-6 rounded-xl border-l-4 border-emerald-500";
        deltaPercContainer.className = "text-sm font-semibold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded";
    } else {
        deltaCard.className = "glass-panel p-6 rounded-xl border-l-4 border-red-500";
        deltaPercContainer.className = "text-sm font-semibold text-red-400 bg-red-950/50 px-2 py-0.5 rounded";
    }

    const churnBody = document.getElementById('co-churn-body');
    if (inactiveClients.length === 0) {
        churnBody.innerHTML = `<tr><td colspan="3" class="px-4 py-8 text-center text-slate-500 italic">Ningún cliente quedó inactivo.</td></tr>`;
    } else {
        churnBody.innerHTML = inactiveClients.sort((a,b) => b.value - a.value).map(c => `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="px-4 py-3 font-medium text-white">${c.name}</td>
                <td class="px-4 py-3 text-right font-mono text-red-400">${formatter.format(c.value)}</td>
                <td class="px-4 py-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-label-caps bg-red-950 text-red-400 border border-red-900/50">SIN COMPRA</span>
                </td>
            </tr>
        `).join('');
    }

    const newBody = document.getElementById('co-new-body');
    if (activatedClients.length === 0) {
        newBody.innerHTML = `<tr><td colspan="3" class="px-4 py-8 text-center text-slate-500 italic">Ningún cliente nuevo activado.</td></tr>`;
    } else {
        newBody.innerHTML = activatedClients.sort((a,b) => b.value - a.value).map(c => `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="px-4 py-3 font-medium text-white">${c.name}</td>
                <td class="px-4 py-3 text-right font-mono text-emerald-400">${formatter.format(c.value)}</td>
                <td class="px-4 py-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-label-caps bg-emerald-950 text-emerald-400 border border-emerald-900/50">NUEVO</span>
                </td>
            </tr>
        `).join('');
    }
}

function closeCrossoverModal() {
    document.getElementById('crossover-modal').classList.add('hidden');
    document.getElementById('crossover-modal').classList.remove('flex', 'items-center', 'justify-center');
}

// Live Search Dropdown Handler
const searchInput = document.getElementById('client-search');
const searchDropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) {
        searchDropdown.classList.add('hidden');
        return;
    }

    const matches = clientsDb.filter(c => c.name.toLowerCase().includes(query) || c.seller.toLowerCase().includes(query));
    searchDropdown.classList.remove('hidden');

    if (matches.length === 0) {
        searchDropdown.innerHTML = `
            <div class="px-4 py-3 text-sm text-on-surface-variant italic text-center">
                No se encontraron resultados
            </div>
        `;
        return;
    }

    searchDropdown.innerHTML = matches.slice(0, 8).map(c => `
        <div onclick="showClientDetail('${c.name.replace(/'/g, "\'")}')" class="px-4 py-3 text-sm text-white hover:bg-white/10 hover:text-secondary cursor-pointer transition-colors flex justify-between items-center">
            <span class="font-medium">${c.name}</span>
            <span class="text-xs font-label-caps text-on-surface-variant">${c.seller}</span>
        </div>
    `).join('');
});

// Close dropdown when clicking outside & deselect month when clicking outside grid
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.add('hidden');
    }

    // Deselect month if clicking outside the month buttons grid
    if (selectedMonthCode !== null) {
        const monthGrid = document.getElementById('month-buttons-grid');
        if (monthGrid && !monthGrid.contains(e.target)) {
            selectMonth(null);
        }
    }
});

// Initial fetch on page load
window.addEventListener('DOMContentLoaded', () => {
    fetchClientsData();

    // Close modals when clicking outside their content panel
    ['client-detail-modal', 'top-clients-modal', 'crossover-modal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
    });
});
