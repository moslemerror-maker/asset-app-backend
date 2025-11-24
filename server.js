/*
 * ================================================
 * BEST CEMENT IT ASSET MANAGEMENT - BACKEND SERVER
 * ================================================
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

// --- DATABASE CONNECTION ---
const NEON_CONNECTION_STRING = process.env.DATABASE_URL;

if (!NEON_CONNECTION_STRING) {
    console.error("FATAL ERROR: DATABASE_URL is missing.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: NEON_CONNECTION_STRING,
    ssl: true
});

// --- SECURITY (CORS) ---
const allowedOrigins = [
    'https://moslemerror-maker.github.io',
    'https://best-itasset.online',
    'https://www.best-itasset.online',
    'https://it.bestcement.co.in'
    'https://asset-app-backend-2tgc.onrender.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(null, true); // Temporarily allow all to debug, or keep strict
        }
        return callback(null, true);
    }
}));

app.use(express.json());

// --- ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, role FROM users');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, password, role]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { password, role } = req.body;
    try {
        let result;
        if (password) {
            result = await pool.query('UPDATE users SET password = $1, role = $2 WHERE id = $3 RETURNING id, username, role', [password, role, id]);
        } else {
            result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role', [role, id]);
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/assets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM assets ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Get assets error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- FIXED POST ASSET ROUTE ---
app.post('/api/assets', async (req, res) => {
    try {
        const a = req.body;
        // Explicitly constructing values to avoid mismatch
        const values = [
            a.assetPrefix, a.assetNumber, a.assetName, a.category, a.status,
            a.employeeName, a.employeeCode, a.cugMobile, a.department, a.designation,
            a.date, a.assetMake, a.assetSerial, a.location, a.notes
        ];
        
        const query = `
            INSERT INTO assets (
                assetprefix, assetnumber, assetname, category, status, 
                employeename, employeecode, cugmobile, department, designation, date,
                assetmake, assetserial, location, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `;

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create asset error details:', err.message); // Better error logging
        res.status(500).json({ error: 'Server error: ' + err.message }); // Send error details to frontend
    }
});

// --- FIXED PUT ASSET ROUTE ---
app.put('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    const a = req.body;
    try {
        const values = [
            a.assetPrefix, a.assetNumber, a.assetName, a.category, a.status,
            a.employeeName, a.employeeCode, a.cugMobile, a.department, a.designation,
            a.date, a.assetMake, a.assetSerial, a.location, a.notes,
            id // ID is the 16th parameter
        ];

        const query = `
            UPDATE assets SET
                assetprefix = $1, assetnumber = $2, assetname = $3, category = $4,
                status = $5, employeename = $6, employeecode = $7, cugmobile = $8,
                department = $9, designation = $10, date = $11,
                assetmake = $12, assetserial = $13, location = $14, notes = $15
            WHERE id = $16
            RETURNING *
        `;

        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update asset error details:', err.message);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

app.delete('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM assets WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Backend running on port ${port}`);
});