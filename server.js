/*
  ============================================================
  -- BEST CEMENT IT ASSET MANAGEMENT - BACKEND SERVER --
  ============================================================
  This server handles all API requests for the asset manager.
  It connects securely to the Neon database and provides
  data to the frontend application.
*/

// --- 1. IMPORTS ---
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

// --- 2. INITIAL CONFIGURATION ---
const app = express();
const port = process.env.PORT || 3000;

// Get the database connection string from Render's environment variables
const NEON_CONNECTION_STRING = process.env.DATABASE_URL;

if (!NEON_CONNECTION_STRING) {
    console.error('FATAL ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1); // Exit the application if the DB string is missing
}

// --- 3. DATABASE CONNECTION ---
// Create a new connection pool to Neon
// We MUST include the ssl config for Neon to work.
const pool = new Pool({
    connectionString: NEON_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: false
    }
});

// Function to check the database connection on startup
const checkDbConnection = async () => {
    try {
        await pool.query('SELECT NOW()');
        console.log('Database connected successfully at', new Date().toISOString());
    } catch (err) {
        console.error('FATAL ERROR: Database connection failed.', err.stack);
        process.exit(1); // Exit if we can't connect to the DB
    }
};

// --- 4. CORS (SECURITY) CONFIGURATION ---
// Define the specific websites (origins) that are allowed to make requests to this server.
const allowedOrigins = [
    'https://gleeful-crepe-a5790f.netlify.app',  // Your Netlify frontend
    'https://asset-app-backend-2tgc.onrender.com', // Your NEW Render backend URL
    'http://localhost:8000'                       // For local testing
];

app.use(cors({
    origin: allowedOrigins
}));

// --- 5. MIDDLEWARE ---
// Allow the server to read JSON data from request bodies
app.use(express.json());

// --- 6. API ROUTES ---

// == AUTH ROUTES ==

/**
 * [POST] /api/login
 * Handles user login.
 * Expects: { username, password }
 * Returns: { id, username, role } or an error
 */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        // This is a simplified, INSECURE password check for demo purposes.
        // A real app MUST hash and salt passwords using a library like 'bcrypt'.
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];
            // Do not send the password back to the client
            res.json({
                id: user.id,
                username: user.username,
                role: user.role
            });
        } else {
            res.status(401).json({ error: 'Invalid username or password.' });
        }
    } catch (err) {
        console.error('Login error:', err.stack);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// == USER MANAGEMENT ROUTES (Admin Only) ==

/**
 * [GET] /api/users
 * Gets a list of all users. (Admin only)
 */
app.get('/api/users', async (req, res) => {
    // In a real app, you would verify an auth token here.
    // For simplicity, we assume if you're asking, you're an admin.
    try {
        const result = await pool.query('SELECT id, username, role FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Get Users error:', err.stack);
        res.status(500).json({ error: 'Server error.' });
    }
});

/**
 * [POST] /api/users
 * Creates a new user. (Admin only)
 * Expects: { username, password, role }
 */
app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, and role are required.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, password, role]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create User error:', err.stack);
        if (err.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: 'This username already exists.' });
        }
        res.status(500).json({ error: 'Server error.' });
    }
});

/**
 * [PUT] /api/users/:id
 * Updates a user's password or role. (Admin only)
 * Expects: { password, role }
 */
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { password, role } = req.body;

    if (!password || !role) {
        return res.status(400).json({ error: 'Password and role are required.' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET password = $1, role = $2 WHERE id = $3 AND username != $4 RETURNING id, username, role',
            [password, role, id, 'admin'] // Added protection: CANNOT edit the main 'admin' user
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found or cannot be edited.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update User error:', err.stack);
        res.status(500).json({ error: 'Server error.' });
    }
});

/**
 * [DELETE] /api/users/:id
 * Deletes a user. (Admin only)
 */
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM users WHERE id = $1 AND username != $2 RETURNING *',
            [id, 'admin'] // Added protection: CANNOT delete the main 'admin' user
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found or cannot be deleted.' });
        }
        res.status(204).send(); // 204 No Content (success)
    } catch (err) {
        console.error('Delete User error:', err.stack);
        res.status(500).json({ error: 'Server error.' });
    }
});


// == ASSET MANAGEMENT ROUTES ==

/**
 * [GET] /api/assets
 * Gets a list of all assets.
 */
app.get('/api/assets', async (req, res) => {
    try {
        // We sort by ID in JS, so no ORDER BY is needed here.
        const result = await pool.query('SELECT * FROM assets');
        res.json(result.rows);
    } catch (err) {
        console.error('Get Assets error:', err.stack);
        res.status(500).json({ error: 'Server error.' });
    }
});

/**
 * [POST] /api/assets
 * Creates a new asset.
 * Expects: { assetPrefix, assetNumber, assetName, ...etc }
 */
app.post('/api/assets', async (req, res) => {
    try {
        const {
            assetPrefix, assetNumber, assetName, category, status,
            employeeName, employeeCode, cugMobile, department, designation, date
        } = req.body;

        // Basic validation
        if (!assetNumber || !assetName || !category || !status || !date) {
            return res.status(400).json({ error: 'Missing required asset fields.' });
        }

        const query = `
            INSERT INTO assets (
                assetprefix, assetnumber, assetname, category, status,
                employeename, employeecode, cugmobile, department, designation, date
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            ) RETURNING *;
        `;
        const values = [
            assetPrefix, assetNumber, assetName, category, status,
            employeeName, employeeCode, cugMobile, department, designation, date
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('Create Asset error:', err.stack);
        // Check for unique constraint violation (assetprefix, assetnumber)
        if (err.code === '23505' && err.constraint === 'assets_assetprefix_assetnumber_key') {
            return res.status(409).json({ error: 'This asset number already exists.' });
        }
        res.status(500).json({ error: 'Server error.' });
    }
});

/**
 * [PUT] /api/assets/:id
 * Updates an existing asset.
 */
app.put('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const {
            assetPrefix, assetNumber, assetName, category, status,
            employeeName, employeeCode, cugMobile, department, designation, date
        } = req.body;

        if (!assetNumber || !assetName || !category || !status || !date) {
            return res.status(400).json({ error: 'Missing required asset fields.' });
        }

        const query = `
            UPDATE assets SET
                assetprefix = $1, assetnumber = $2, assetname = $3, category = $4,
                status = $5, employeename = $6, employeecode = $7, cugmobile = $8,
                department = $9, designation = $10, date = $11
            WHERE id = $12
            RETURNING *;
        `;
        const values = [
            assetPrefix, assetNumber, assetName, category, status,
            employeeName, employeeCode, cugMobile, department, designation, date,
            id
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Asset not found.' });
        }
        res.json(result.rows[0]);

    } catch (err) {
        console.error('Update Asset error:', err.stack);
        if (err.code === '23505' && err.constraint === 'assets_assetprefix_assetnumber_key') {
            return res.status(409).json({ error: 'This asset number already exists.' });
        }
        res.status(500).json({ error: 'Server error.' });
    }
});

/**
 * [DELETE] /api/assets/:id
 * Deletes an asset.
 */
app.delete('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    // Note: We are not checking for 'admin' role here, but we should be.
    // The frontend logic already hides the button.
    try {
        const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Asset not found.' });
        }
        res.status(204).send(); // 204 No Content (success)
    } catch (err) {
        console.error('Delete Asset error:', err.stack);
        res.status(500).json({ error: 'Server error.' });
    }
});


// --- 7. START THE SERVER ---
app.listen(port, '0.0.0.0', () => {
    console.log(`Backend API server is running on port ${port}`);
    // Check the DB connection *after* the server starts listening
    checkDbConnection();
});

