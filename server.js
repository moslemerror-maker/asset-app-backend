/*--- THIS IS A NEW COMMENT by iMOSLEM TO FORCE A DEPLOYMENT ---
 * ================================================
 * BEST CEMENT IT ASSET MANAGEMENT - BACKEND SERVER
 * ================================================
 */

// --- IMPORTS ---
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

// --- INITIALIZATION ---
const app = express();
const port = process.env.PORT || 10000; // Use Render's port, or 10000 for local

// --- DATABASE CONNECTION ---
const NEON_CONNECTION_STRING = process.env.DATABASE_URL;

if (!NEON_CONNECTION_STRING) {
    console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: NEON_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: false
    }
});

// Helper function to check DB connection
const checkDbConnection = async () => {
    try {
        await pool.query('SELECT NOW()');
        console.log(`Database connected successfully at ${new Date().toUTCString()}`);
    } catch (err) {
        console.error('Database connection error:', err);
    }
};

// --- SECURITY (CORS) ---
const allowedOrigins = [
    'https://moslemerror-maker.github.io',
    'https://best-itasset.online'
    'https://www.best-itasset.online'
    'https://asset-app-backend-2tgc.onrender.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));


// --- MIDDLEWARE ---
app.use(express.json());


// --- API ROUTES ---

// 1. GET /api/health
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// 2. POST /api/login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        res.json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});


// --- USER MANAGEMENT ROUTES (Admin Only) ---

// 3. GET /api/users
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, role FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 4. POST /api/users
app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, and role are required' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, password, role]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create user error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// 5. PUT /api/users/:id
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { password, role } = req.body;
    if (!role) {
        return res.status(400).json({ error: 'Role is required' });
    }
    try {
        let result;
        if (password) {
            result = await pool.query(
                'UPDATE users SET password = $1, role = $2 WHERE id = $3 RETURNING id, username, role',
                [password, role, id]
            );
        } else {
            result = await pool.query(
                'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
                [role, id]
            );
        }
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 6. DELETE /api/users/:id
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// --- ASSET MANAGEMENT ROUTES ---

// 7. GET /api/assets
app.get('/api/assets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM assets ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Get assets error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 8. POST /api/assets
app.post('/api/assets', async (req, res) => {
    try {
        const newAsset = req.body;
        // UPDATED: Added 'department' and 'notes'
        const query = `
            INSERT INTO assets (
                assetprefix, assetnumber, assetname, category, status, 
                employeename, employeecode, cugmobile, designation, date,
                assetmake, assetserial, location, department, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *;
        `;
        const values = [
            newAsset.assetPrefix, newAsset.assetNumber, newAsset.assetName,
            newAsset.category, newAsset.status, newAsset.employeeName,
            newAsset.employeeCode, newAsset.cugMobile, newAsset.designation, 
            newAsset.date, newAsset.assetMake, newAsset.assetSerial, 
            newAsset.location, newAsset.department, newAsset.notes // NEW FIELDS
        ];
        
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
        
    } catch (err) {
        console.error('Create asset error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This asset number already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// 9. PUT /api/assets/:id
app.put('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    const assetData = req.body;
    
    try {
        // UPDATED: Added 'department' and 'notes'
        const query = `
            UPDATE assets SET
                assetprefix = $1, assetnumber = $2, assetname = $3, category = $4,
                status = $5, employeename = $6, employeecode = $7, cugmobile = $8,
                designation = $9, date = $10, assetmake = $11, assetserial = $12, 
                location = $13, department = $14, notes = $15
            WHERE id = $16
            RETURNING *;
        `;
        const values = [
            assetData.assetPrefix, assetData.assetNumber, assetData.assetName,
            assetData.category, assetData.status, assetData.employeeName,
            assetData.employeeCode, assetData.cugMobile, assetData.designation,
            assetData.date, assetData.assetMake, assetData.assetSerial,
            assetData.location, assetData.department, assetData.notes, // NEW FIELDS
            id
        ];
        
        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.json(result.rows[0]);
        
    } catch (err) {
        console.error('Update asset error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This asset number already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// 10. DELETE /api/assets/:id
app.delete('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Delete asset error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// --- START SERVER ---
app.listen(port, '0.0.0.0', () => {
    console.log(`Backend API server is running on port ${port}`);
    checkDbConnection();
});