/**
 * Lightweight Zero-Dependency Local Server for Finance App
 * Automatically reads and writes directly to ./database.json in this folder
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// MIME types dictionary
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 1. API: Read local database.json
    if (req.url === '/api/db' && req.method === 'GET') {
        if (fs.existsSync(DB_FILE)) {
            try {
                const data = fs.readFileSync(DB_FILE, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(data);
                return;
            } catch (err) {
                console.error('Error reading database.json:', err);
            }
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database not found' }));
        return;
    }

    // 2. API: Write directly to local database.json
    if (req.url === '/api/db' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                // Verify valid JSON
                JSON.parse(body);
                fs.writeFileSync(DB_FILE, body, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Saved to database.json' }));
            } catch (err) {
                console.error('Error writing to database.json:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // 3. Static File Server (index.html, style.css, app.js, etc.)
    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const safePath = path.normalize(path.join(__dirname, filePath));

    if (!safePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(safePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404: Fayl topilmadi');
            } else {
                res.writeHead(500);
                res.end(`Server xatosi: ${err.code}`);
            }
        } else {
            const ext = path.extname(safePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Finance Web Dashboard muvaffaqiyatli ishga tushdi!`);
    console.log(`📍 Manzil: http://localhost:${PORT}`);
    console.log(`💾 Baza fayli: ${DB_FILE}`);
    console.log(`====================================================`);
});
