/*
  ============================================================
  BEST CEMENT IT ASSET MANAGEMENT - BACKEND SERVER
  ============================================================
  This file connects to the Neon (Postgres) database
  and provides all the API routes for your frontend app.
  
  Corrected Version:
  - No syntax errors
  - No placeholders or '...'
  - No 'cors' declaration errors
  - No 'app.listen' errors
  - Includes 'ssl' fix for Neon
*/

// --- 1. IMPORTS ---
// Import required node modules
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); // <-- Declared ONCE

// --- 2. CONFIGURATION ---
const app = express();

// Use the port Render assigns, or 3000 for local testing
const port = process.env.PORT || 3000;

// Read the connection string from an environment variable for security
// This is the 'DATABASE_URL' key you set in the Render dashboard
const NEON_CONNECTION_STRING = process.env.DATABASE_URL;

// --- 3. DATABASE CONNECTION ---
// Create a new pool to connect to the Neon database
// This includes the critical 'ssl' fix for Neon
const pool = new Pool({
    connectionString: NEON_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: false
    }
});

// Asynchronous function to check the database connection on startup
async function checkDbConnection() {
    try {
        await pool.query('SELECT NOW()');
        console.log(`Database connected successfully at ${new Date().toUTCString()}`);
    } catch (err) {
        console.error('!!! FATAL: Database connection failed !!!', err.stack);
    }
}

// --- 4. MIDDLEWARE ---
// Use CORS to allow your Netlify frontend to make requests to this server
// This simple version allows all origins.
app.use(cors());

// Use express.json() to parse incoming request bodies as JSON
app.use(express.json());

// --- 5. API ROUTES ---

/*
 * [POST] /api/login
 * Handles user login.
 * Expects { username, password } in the body.
 */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        // Find the user in the 'users' table
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        const user = result.rows[0];

        if (!user) {
            // User not found
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        // Check password
        // In a real app, you MUST hash passwords. Here we check plain text.
        if (password === user.password) {
            // Password is correct
            // Send back user data (excluding password)
            res.json({
                id: user.id,
                username: user.username,
                role: user.role
            });
        } else {
            // Password incorrect
            return res.status(401).json({ error: 'Invalid username or password.' });
        }
    } catch (err) {
        console.error('Login error:', err.stack);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

/*
 * [GET] /api/assets
 * Gets all assets from the database.
 */
app.get('/api/assets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM assets');
        res.json(result.rows);
    } catch (err) {
        console.error('Get assets error:', err.stack);
        res.status(500).json({ error: 'Failed to retrieve assets.' });
    }
});

/*
 * [POST] /api/assets
 * Creates a new asset.
 */
app.post('/api/assets', async (req, res) => {
    const {
        assetprefix, assetnumber, assetname, category, status,
        employeename, employeecode, cugmobile, department,
        designation, date
    } = req.body;

    // Basic validation
    if (!assetprefix || !assetnumber || !assetname || !category || !status || !date) {
        return res.status(400).json({ error: 'Missing required asset fields.' });
    }

    const query = `
        INSERT INTO assets (
            assetprefix, assetnumber, assetname, category, status,
            employeename, employeecode, cugmobile, department,
            designation, date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
    `;
    const values = [
        assetprefix, assetnumber, assetname, category, status,
        employeename, employeecode, cugmobile, department,
        designation, date
    ];

    try {
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create asset error:', err.stack);
        // Check for the unique constraint violation
        if (err.code === '23505') { // 'unique_violation'
            return res.status(409).json({ error: 'This asset number already exists.' });
        }
        res.status(500).json({ error: 'Server error, failed to create asset.' });
    }
});

/*
 * [PUT] /api/assets/:id
 * Updates an existing asset by its ID.
 */
app.put('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    const {
        assetprefix, assetnumber, assetname, category, status,
        employeename, employeecode, cugmobile, department,
        designation, date
    } = req.body;

    // Basic validation
    if (!assetprefix || !assetnumber || !assetname || !category || !status || !date) {
        return res.status(400).json({ error: 'Missing required asset fields.' });
    }

    const query = `
        UPDATE assets
        SET 
            assetprefix = $1, assetnumber = $2, assetname = $3, category = $4,
            status = $5, employeename = $6, employeecode = $7, cugmobile = $8,
            department = $9, designation = $10, date = $11
        WHERE id = $12
        RETURNING *;
    `;
    const values = [
        assetprefix, assetnumber, assetname, category, status,
        employeename, employeecode, cugmobile, department,
        designation, date, id
    ];

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Asset not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update asset error:', err.stack);
        // Check for the unique constraint violation
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This asset number already exists.' });
        }
        res.status(500).json({ error: 'Server error, failed to update asset.' });
    }
});

/*
 * [DELETE] /api/assets/:id
 * Deletes an asset by its ID.
 */
app.delete('/api/assets/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING *;', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Asset not found.' });
        }
        res.status(200).json({ message: 'Asset deleted successfully.' });
    } catch (err) {
        console.error('Delete asset error:', err.stack);
        res.status(500).json({ error: 'Server error, failed to delete asset.' });
    }
});


// --- USER MANAGEMENT ROUTES (ADMIN ONLY) ---
// Note: These routes are not protected. In a real app, you would
// add middleware to check if state.currentUser.role === 'admin'

/*
 * [GET] /api/users
 * Gets all users (for the user management panel).
 */
app.get('/api/users', async (req, res) => {
    try {
        // Exclude passwords from the query
        const result = await pool.query('SELECT id, username, role FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Get users error:', err.stack);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

/*
 * [POST] /api/users
 * Creates a new user (sub-admin or user).
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
            // Again, password should be hashed here
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create user error:', err.stack);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This username is already taken.' });
        }
        res.status(500).json({ error: 'Server error, failed to create user.' });
    }
});

/*
 * [PUT] /api/users/:id
 * Updates a user's password or role.
 */
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { password, role } = req.body;

    if (!password || !role) {
        return res.status(400).json({ error: 'Password and role are required.' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET password = $1, role = $2 WHERE id = $3 RETURNING id, username, role',
            [password, role, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update user error:', err.stack);
        res.status(500).json({ error: 'Server error, failed to update user.' });
    }
});

/*
 * [DELETE] /api/users/:id
 * Deletes a user.
 */
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *;', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.status(200).json({ message: 'User deleted successfully.' });
    } catch (err) {
        console.error('Delete user error:', err.stack);
        res.status(500).json({ error: 'Server error, failed to delete user.' });
    }
});


// --- 6. START SERVER ---
// Start the backend server to listen for connections
// Listen on '0.0.0.0' to be accessible on Render
app.listen(port, '0.0.0.0', () => {
    console.log(`Backend API server is running on port ${port}`);
    // Check the database connection once the server is running
    checkDbConnection();
});

