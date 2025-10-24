/*
* This is your new backend server.
*
* --- HOW TO RUN ---
* 1. Save this file and `package.json` in a new folder (e.g., C:\asset-backend).
* 2. Open a command prompt in that folder.
* 3. Run: npm install
* 4. After installation, run: node server.js
* 5. This server must be left running on 192.168.20.235.
*/

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

// ...
const app = express();
// HEROKU/RENDER compatibility: Use the port they assign, or 3000 for local
const port = process.env.PORT || 3000; 

// ...
// Read the connection string from an environment variable for security
const NEON_CONNECTION_STRING = process.env.DATABASE_URL;

// Connect to Neon
const pool = new Pool({
    connectionString: NEON_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: false
    }
});
// ...

// Middleware
const allowedOrigins = [
  'httpss://gleeful-crepe-a5790f.netlify.app/,
  'http://localhost:8000' // Keep this for local testing
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json()); // Allow the server to read JSON

// Test DB Connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('--- DATABASE CONNECTION FAILED ---');
        console.error(err);
        console.error('Please check your NEON_CONNECTION_STRING and network access.');
    } else {
        console.log(`Database connected successfully at ${res.rows[0].now}`);
    }
});


// --- API ROUTES ---

// === USER API ===
// (No changes to User API routes)

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            delete user.password; 
            res.json(user);
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// GET /api/users (Admin only)
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, role FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/users (Create User - Admin)
app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    try {
        const check = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (check.rows.length > 0) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, password, role]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create user error:', err);
        // Check for unique constraint violation (just in case)
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username already exists.' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/users/:id (Update User - Admin)
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { password, role } = req.body;
    
    if (!password || !role) {
        return res.status(400).json({ error: 'Password and role are required' });
    }
    try {
        const result = await pool.query(
            'UPDATE users SET password = $1, role = $2 WHERE id = $3 RETURNING id, username, role',
            [password, role, id]
        );
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/users/:id (Delete User - Admin)
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const userCheck = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length > 0 && userCheck.rows[0].username === 'admin') {
             return res.status(403).json({ error: 'Cannot delete the main admin account' });
        }

        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount > 0) {
            res.status(204).send(); // Success, no content
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// === ASSET API ===

// GET /api/assets
app.get('/api/assets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM assets ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Get assets error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/assets (Create Asset)
app.post('/api/assets', async (req, res) => {
    try {
        const newAsset = req.body;
        const query = `
            INSERT INTO assets (
                assetprefix, assetnumber, assetname, category, status, 
                employeename, employeecode, cugmobile, department, designation, date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *;
        `;
        const values = [
            newAsset.assetPrefix, newAsset.assetNumber, newAsset.assetName,
            newAsset.category, newAsset.status, newAsset.employeeName,
            newAsset.employeeCode, newAsset.cugMobile, newAsset.department,
            newAsset.designation, newAsset.date
        ];
        
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create asset error:', err);
        // **NEW:** Check for the unique constraint violation
        // 23505 is the error code for 'unique_violation'
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This asset number already exists. Please use a unique number.' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/assets/:id (Update Asset)
app.put('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    const updatedAsset = req.body;
    try {
        const query = `
            UPDATE assets SET
                assetprefix = $1, assetnumber = $2, assetname = $3, category = $4, status = $5,
                employeename = $6, employeecode = $7, cugmobile = $8, department = $9, 
                designation = $10, date = $11
            WHERE id = $12
            RETURNING *;
        `;
        const values = [
            updatedAsset.assetPrefix, updatedAsset.assetNumber, updatedAsset.assetName,
            updatedAsset.category, updatedAsset.status, updatedAsset.employeeName,
            updatedAsset.employeeCode, updatedAsset.cugMobile, updatedAsset.department,
            updatedAsset.designation, updatedAsset.date,
            id
        ];
        
        const result = await pool.query(query, values);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Asset not found' });
        }
    } catch (err) {
        console.error('Update asset error:', err);
        // **NEW:** Check for the unique constraint violation here too
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This asset number already exists. Please use a unique number.' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/assets/:id (Delete Asset - Main Admin Only)
app.delete('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount > 0) {
            res.status(204).send(); // Success, no content
        } else {
            res.status(404).json({ error: 'Asset not found' });
        }
    } catch (err) {
        console.error('Delete asset error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// --- START SERVER ---
// We listen on '0.0.0.0' to be accessible from other computers on the network
// ...
// Start the backend server
app.listen(port, '0.0.0.0', () => {
    console.log(`Backend API server is running on port ${port}`);
    checkDbConnection();
});
