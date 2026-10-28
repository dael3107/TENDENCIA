const express = require('express');
const { google } = require('googleapis');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ID del Google Sheet de Tendencia 2026
const SPREADSHEET_ID = '1813q79xLn2_NG117Bh_hMFPXnaQr7KmAGIUHJ3eu8Cw';

// Año al que corresponden las fechas de la hoja semanal
const ANIO_SEMANAL = 2026;

// Proyecto de Firebase donde inician sesión los usuarios (ver js/auth.js)
const FIREBASE_PROJECT_ID = 'tendencia-2026';

// Tiempo que se guardan en memoria los datos del Sheet antes de volver a pedirlos
const CACHE_MS = 2 * 60 * 1000;

// Autenticación: Soporta Vercel (Variable de Entorno) o Local (credentials.json)
let auth;
if (process.env.GOOGLE_CREDENTIALS) {
    // Modo Producción (Vercel): Lee el JSON desde las variables de entorno
    auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
} else {
    // Modo Local (Tu PC): Lee el archivo físico
    auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, 'credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
}

// Firebase Admin solo se usa para verificar el token de sesión.
// Para eso basta con el projectId (no necesita credenciales).
admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });

// ─────────────────────────────────────────────────────────────
// LECTURA DEL GOOGLE SHEET
// ─────────────────────────────────────────────────────────────

const cache = new Map();

/**
 * Lee las filas crudas de una hoja, usando la caché en memoria.
 * @param {string} sheetName - Nombre de la pestaña del Sheet.
 * @returns {Array<Array<string>>} - Filas tal como vienen del Sheet.
 */
async function getSheetRows(sheetName) {
    const hit = cache.get(sheetName);
    if (hit && Date.now() - hit.time < CACHE_MS) return hit.rows;

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A:Z`,
    });

    const rows = response.data.values || [];
    cache.set(sheetName, { rows, time: Date.now() });
    return rows;
}

/**
 * Lee una hoja del Google Sheet y la convierte en array de objetos.
 * @param {string} sheetName - Nombre de la pestaña del Sheet.
 * @returns {Array<Object>} - Filas como objetos con los encabezados como claves.
 */
async function getSheetData(sheetName) {
    const rows = await getSheetRows(sheetName);
    if (rows.length < 2) return [];

    const headers = rows[0]; // Primera fila = nombres de columna
    return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = row[i] !== undefined ? row[i] : '';
        });
        return obj;
    });
}

/**
 * Convierte "S/.12,345.67" en 12345.67. Devuelve null si la celda está vacía.
 */
function parseMonto(valor) {
    const limpio = String(valor ?? '').replace(/S\/\.?\s?/g, '').replace(/,/g, '').trim();
    if (limpio === '') return null;
    const num = parseFloat(limpio);
    return isNaN(num) ? null : num;
}

// Nombres de mes tal como pueden aparecer en la hoja (acepta "SETIEMBRE")
const MESES_REGEX = [
    /ENERO/, /FEBRERO/, /MARZO/, /ABRIL/, /MAYO/, /JUNIO/,
    /JULIO/, /AGOSTO/, /SE?PTIEMBRE/, /OCTUBRE/, /NOVIEMBRE/, /DICIEMBRE/
];

/**
 * Interpreta textos como "1 AL 4 DE ENERO" o "31 DE AGOSTO".
 * @returns {{mes: number, diaInicio: number, diaFin: number} | null}
 */
function parseRangoSemana(texto) {
    const t = String(texto).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const mes = MESES_REGEX.findIndex(re => re.test(t));
    const dias = (t.match(/\d+/g) || []).map(Number);
    if (mes === -1 || dias.length === 0) return null;
    return { mes, diaInicio: dias[0], diaFin: dias[dias.length - 1] };
}

/**
 * Lee la hoja "ESTADISTICA SEMANAL 2026".
 * Fila 1: vendedores · Fila 2: objetivo mensual · Fila 3: títulos · Fila 4 en adelante: semanas.
 */
async function getEstadisticaSemanal() {
    const rows = await getSheetRows('ESTADISTICA SEMANAL 2026');
    const encabezado = rows[0] || [];
    const filaObjetivos = rows[1] || [];

    const vendedores = [];
    const objetivos = {};
    encabezado.forEach((nombre, col) => {
        if (col === 0 || !String(nombre).trim()) return;
        const vendedor = String(nombre).trim().toUpperCase();
        vendedores.push({ nombre: vendedor, col });
        objetivos[vendedor] = parseMonto(filaObjetivos[col]) || 0;
    });

    const semanas = [];
    const noReconocidas = [];
    rows.slice(3).forEach(row => {
        const etiqueta = String(row[0] || '').replace(/\s+/g, ' ').trim();
        if (!etiqueta) return;

        const rango = parseRangoSemana(etiqueta);
        if (!rango) { noReconocidas.push(etiqueta); return; }

        const montos = {};
        let cargada = false;
        vendedores.forEach(({ nombre, col }) => {
            const monto = parseMonto(row[col]);
            montos[nombre] = monto || 0;
            // REDIPLAST es la suma de todos y muestra S/.0.00 aunque la semana esté vacía
            if (nombre !== 'REDIPLAST' && monto !== null) cargada = true;
        });

        semanas.push({ etiqueta, ...rango, montos, cargada });
    });

    if (noReconocidas.length) {
        console.warn('Semanas sin mes reconocible en la hoja:', noReconocidas);
    }

    return {
        anio: ANIO_SEMANAL,
        vendedores: vendedores.map(v => v.nombre),
        objetivos,
        semanas,
        noReconocidas,
    };
}

// ─────────────────────────────────────────────────────────────
// SEGURIDAD: SOLO USUARIOS CON SESIÓN PUEDEN LEER LA API
// ─────────────────────────────────────────────────────────────

// El navegador envía el token de Firebase en "Authorization: Bearer <token>"
async function requireAuth(req, res, next) {
    const match = (req.headers.authorization || '').match(/^Bearer (.+)$/);
    if (!match) return res.status(401).json({ error: 'Sesión requerida' });

    try {
        req.user = await admin.auth().verifyIdToken(match[1]);
        next();
    } catch (error) {
        res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
}

app.use('/api', requireAuth);

// ─────────────────────────────────────────────────────────────
// ENDPOINTS DE LA API
// ─────────────────────────────────────────────────────────────

// GET /api/clientes → Lee la hoja "TENDENCIA 2026" (datos de clientes)
app.get('/api/clientes', async (req, res) => {
    try {
        const data = await getSheetData('TENDENCIA 2026');
        res.json(data);
    } catch (error) {
        console.error('Error en /api/clientes:', error.message);
        res.status(500).json({ error: 'Error al leer datos de clientes' });
    }
});

// GET /api/vendedores → Lee la hoja "REPORTE DE VENTAS VENDEDOR"
app.get('/api/vendedores', async (req, res) => {
    try {
        const data = await getSheetData('REPORTE DE VENTAS VENDEDOR');
        res.json(data);
    } catch (error) {
        console.error('Error en /api/vendedores:', error.message);
        res.status(500).json({ error: 'Error al leer datos de vendedores' });
    }
});

// GET /api/semanal → Lee la hoja "ESTADISTICA SEMANAL 2026"
app.get('/api/semanal', async (req, res) => {
    try {
        res.json(await getEstadisticaSemanal());
    } catch (error) {
        console.error('Error en /api/semanal:', error.message);
        res.status(500).json({ error: 'Error al leer la estadística semanal' });
    }
});

// ─────────────────────────────────────────────────────────────
// ARCHIVOS ESTÁTICOS
// ─────────────────────────────────────────────────────────────

// Solo se publican estas carpetas y páginas. Todo lo demás (credentials.json,
// .env, server.js, package.json...) queda fuera, sin importar mayúsculas.
['css', 'js', 'IMAGENES'].forEach(dir => {
    app.use(`/${dir}`, express.static(path.join(__dirname, dir)));
});

const PAGINAS = ['index', 'dashboard', 'reporte_de_ventas', 'reporte_semanal'];

// Ruta raíz → index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// /dashboard y /dashboard.html → dashboard.html
app.get('/:pagina', (req, res, next) => {
    const nombre = req.params.pagina.replace(/\.html$/, '');
    if (!PAGINAS.includes(nombre)) return next();
    res.sendFile(path.join(__dirname, `${nombre}.html`));
});

// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n✅ Servidor Tendencia 2026 corriendo en http://localhost:${PORT}\n`);
});
