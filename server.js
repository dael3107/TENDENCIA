const express = require('express');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ID del Google Sheet de Tendencia 2026
const SPREADSHEET_ID = '1813q79xLn2_NG117Bh_hMFPXnaQr7KmAGIUHJ3eu8Cw';

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

/**
 * Lee una hoja del Google Sheet y la convierte en array de objetos.
 * @param {string} sheetName - Nombre de la pestaña del Sheet.
 * @returns {Array<Object>} - Filas como objetos con los encabezados como claves.
 */
async function getSheetData(sheetName) {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const range = `'${sheetName}'!A:Z`;
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
    });

    const rows = response.data.values || [];
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

// ─────────────────────────────────────────────────────────────
// ARCHIVOS ESTÁTICOS
// ─────────────────────────────────────────────────────────────

// Bloquear acceso directo a archivos sensibles desde el navegador
app.use((req, res, next) => {
    const blocked = ['/credentials.json', '/.env', '/server.js'];
    if (blocked.includes(req.path)) {
        return res.status(403).end();
    }
    next();
});

// Servir los HTML, CSS, JS e imágenes del proyecto
// extensions: ['html'] permite acceder a /dashboard en vez de /dashboard.html
app.use(express.static(__dirname, { extensions: ['html'] }));

// Ruta raíz → index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n✅ Servidor Tendencia 2026 corriendo en http://localhost:${PORT}\n`);
});

