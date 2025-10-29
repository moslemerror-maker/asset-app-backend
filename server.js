/*
 * ================================================
 * BEST CEMENT IT ASSET MANAGEMENT - BACKEND SERVER
 * ================================================
 * This server connects to the Neon (Postgres) database
 * and provides API endpoints for the frontend app.
 */

// --- IMPORTS ---
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

// --- INITIALIZATION ---
const app = express();
const port = process.env.PORT || 10000; // Use Render's port, or 10000 for local

// --- DATABASE CONNECTION ---
// Get the connection string from Render's Environment Variables
const NEON_CONNECTION_STRING = process.env.DATABASE_URL;

if (!NEON_CONNECTION_STRING) {
    console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1); // Exit the application if the DB string is missing
}

// Create a new Pool.
// This is the correct configuration for Neon.
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
// This is the correct, final list of allowed origins.
const allowedOrigins = [
    'https://moslemerror-maker.github.io',
    'https://asset-app-backend-2tgc.onrender.com'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));


// --- MIDDLEWARE ---
// This line allows our server to read JSON from the body of requests
app.use(express.json());


// --- API ROUTES ---

// 1. GET /api/health - A simple check to see if the server is running
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// 2. POST /api/login - User Authentication
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // In a real app, passwords should be hashed!
        // We are comparing plain text for this demo.
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Don't send the password back to the frontend
        res.json({
            id: user.id,
            username: user.username,
            role: user.role
        });
        
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});


// --- USER MANAGEMENT ROUTES (Admin Only) ---

// Middleware to check if user is an admin
// NOTE: We are skipping this for simplicity, but in a real app
// you would use JWTs (JSON Web Tokens) to protect these routes.

// 3. GET /api/users - Get all users
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, role FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 4. POST /api/users - Create a new user
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
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// 5. PUT /api/users/:id - Update a user (password or role)
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { password, role } = req.body;

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
            // If no password, just update the role
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

// 6. DELETE /api/users/:id - Delete a user
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(204).send(); // 204 No Content (success)
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// --- ASSET MANAGEMENT ROUTES ---

// 7. GET /api/assets - Get all assets
app.get('/api/assets', async (req, res) => {
    try {
        // Select all columns from the assets table
        const result = await pool.query('SELECT * FROM assets');
        res.json(result.rows);
    } catch (err) {
        console.error('Get assets error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 8. POST /api/assets - Create a new asset
app.post('/api/assets', async (req, res) => {
    try {
        const newAsset = req.body;
        // UPDATED: Added assetmake and assetserial
        const query = `
            INSERT INTO assets (
                assetprefix, assetnumber, assetname, category, status, 
                employeename, employeecode, cugmobile, department, designation, date,
                assetmake, assetserial
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *;
        `;
        const values = [
            newAsset.assetPrefix, newAsset.assetNumber, newAsset.assetName,
            newAsset.category, newAsset.status, newAsset.employeeName,
            newAsset.employeeCode, newAsset.cugMobile, newAsset.department,
            newAsset.designation, newAsset.date,
            // NEW
            newAsset.assetMake, newAsset.assetSerial
        ];
        
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]); // Send the newly created asset back
        
    } catch (err) {
        console.error('Create asset error:', err);
        if (err.code === '23505') { // Unique violation (e.g., asset number)
            return res.status(409).json({ error: 'This asset number already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// 9. PUT /api/assets/:id - Update an existing asset
app.put('/api/assets/:id', async (req, res) => {
    const { id } = req.params;
    const assetData = req.body;
    
    try {
        // UPDATED: Added assetmake and assetserial
        const query = `
            UPDATE assets SET
                assetprefix = $1, assetnumber = $2, assetname = $3, category = $4,
                status = $5, employeename = $6, employeecode = $7, cugmobile = $8,
                department = $9, designation = $10, date = $11,
                assetmake = $12, assetserial = $13
            WHERE id = $14
            RETURNING *;
        `;
        const values = [
            assetData.assetPrefix, assetData.assetNumber, assetData.assetName,
            assetData.category, assetData.status, assetData.employeeName,
            assetData.employeeCode, assetData.cugMobile, assetData.department,
            assetData.designation, assetData.date,
            // NEW
            assetData.assetMake, assetData.assetSerial,
            // ID
            id
        ];
        
        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.json(result.rows[0]); // Send the updated asset back
        
    } catch (err) {
        console.error('Update asset error:', err);
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'This asset number already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// 10. DELETE /api/assets/:id - Delete an asset
app.delete('/api/assets/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.status(204).send(); // 204 No Content (success)
    } catch (err) {
        console.error('Delete asset error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// --- START SERVER ---
// This listens on '0.0.0.0' which is required for Render
app.listen(port, '0.0.0.0', () => {
    console.log(`Backend API server is running on port ${port}`);
    // Check the DB connection once the server is running
    checkDbConnection();
});

