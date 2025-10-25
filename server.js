/*
* ==================================================================
* asset-backend/server.js
*
* This is the complete, clean backend server code.
* It connects to Neon, handles API requests, and has the
* correct CORS policy to allow your Netlify app to connect.
* ==================================================================
*/

// --- IMPORTS ---
// This is the "shopping list" of libraries we need.
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

// --- INITIALIZATION ---
const app = express();
const port = process.env.PORT || 3000; // Render will set the PORT environment variable

// --- CONFIGURATION ---

// Get the Neon connection string from the Environment Variable (set in Render)
const NEON_CONNECTION_STRING = process.env.DATABASE_URL;

// --- SECURITY (CORS) ---
// This is the CRITICAL fix.
// We are telling the server: "Only allow requests from these websites."

// 1. YOUR Netlify app URL
const netlifyAppUrl = 'https://gleeful-crepe-a5790f.netlify.app';

// 2. Define which websites (origins) are allowed to make requests
const allowedOrigins = [
    netlifyAppUrl,
    'http://localhost:8000' // For local testing
];

// 3. Set up the CORS policy
const corsOptions = {
    origin: function (origin, callback) {
        // Check if the incoming request's origin is in our allowed list
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            // It's allowed!
            callback(null, true);
        } else {
            // It's not allowed!
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
};

// --- DATABASE CONNECTION ---
// Create a new connection pool to your Neon database
// This includes the 'ssl' fix required by Render to connect to Neon.
const pool = new Pool({
    connectionString: NEON_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: false
    }
});

// A helper function to check the database connection on startup
async function checkDbConnection() {
    try {
        await pool.query('SELECT NOW()');
        console.log(`Database connected successfully at ${new Date().toUTCString()}`);
    } catch (err) {
        console.error('!!! Database connection failed on startup !!!', err);
    }
}

// --- MIDDLEWARE ---
// These lines run on *every* request, *before* the API routes.

// 1. Apply our new, secure CORS policy
app.use(cors(corsOptions));
// 2. Allow the server to read incoming JSON data (from forms, etc.)
app.use(express.json());


// --- ================== ---
// ---    API ROUTES      ---
// --- ================== ---

// --- 1. HEALTH CHECK ---
// A simple route to check if the server is running
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// --- 2. USER ROUTES ---

// Handle Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        // Query the 'users' table (we created this with setup.sql)
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );

        if (result.rows.length > 0) {
            // User found! Send back the user data (id, username, role)
            const user = result.rows[0];
            res.json({ id: user.id, username: user.username, role: user.role });
        } else {
            // No user found with that username/password
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error('Login query error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get All Users (Admin Only)
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, role FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Get Users query error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create New User (Admin Only)
app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, password, role]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create User query error:', err);
        if (err.code === '23505') { // 23505 is the code for 'unique_violation'
             return res.status(409).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Update User (Admin Only)
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { password, role } = req.body; // Only allow password and role changes

    if (!role) {
        return res.status(400).json({ error: 'Role is required' });
    }

    try {
        let result;
        if (password) {
            // If password is provided, update it
            result = await pool.query(
                'UPDATE users SET password = $1, role = $2 WHERE id = $3 RETURNING id, username, role',
                [password, role, id]
            );
        } else {
            // If password is NOT provided, only update the role
            result = await pool.query(
                'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
                [role, id]
            );
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update User query error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete User (Admin Only)
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params; 
    try {
        // We added a check to the database so 'admin' user can't be deleted
        await pool.query('DELETE FROM users WHERE id = $1 AND username != $2', [id, 'admin']);
        res.status(204).send(); // 204 means "No Content" (success)
    } catch (err) {
        console.error('Delete User query error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// --- 3. ASSET ROUTES ---

// Get All Assets
app.get('/api/assets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM assets');
        res.json(result.rows);
    } catch (err) {
        console.error('Get Assets query error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create New Asset
app.post('/api/assets', async (req, res) => {
    try {
        const newAsset = req.body;
        const query = `
            INSERT INTO assets (
                assetprefix, assetnumber, assetname, category, status, 
                employeename, employeecode, cugmobile, department, designation, date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        console.error('Create Asset query error:', err);
        // This is the error code for the 'unique_asset_number' constraint we added
        if (err.code === '23505') { 
            return res.status(409).json({ error: 'This asset number already exists.' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Asset
app.put('/api/assets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const asset = req.body;
        const query = `
            UPDATE assets SET 
                assetprefix = $1, assetnumber = $2, assetname = $3, category = $4, status = $5, 
                employeename = $6, employeecode = $7, cugmobile = $8, department = $9, 
                designation = $10, date = $11
            WHERE id = $12
            RETURNING *;
        `;
        const values = [
            asset.assetPrefix, asset.assetNumber, asset.assetName,
            asset.category, asset.status, asset.employeeName,
            asset.employeeCode, asset.cugMobile, asset.department,
            asset.designation, asset.date, id
        ];
        
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update Asset query error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This asset number already exists.' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Asset
app.delete('/api/assets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM assets WHERE id = $1', [id]);
        res.status(204).send(); // Success
    } catch (err) {
        console.error('Delete Asset query error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// --- ================== ---
// ---    START SERVER    ---
// --- ================== ---

// This tells the server to listen on '0.0.0.0' (which Render needs)
// and on the port Render provides (or 3000 by default).
app.listen(port, '0.0.0.0', () => {
    console.log(`Backend API server is running on port ${port}`);
    // Now we check the DB connection *after* the server starts listening
    checkDbConnection();
});

