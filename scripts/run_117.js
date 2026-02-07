const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    console.log('Loading .env.local from', envPath);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
}

const connectionString = process.env.POSTGRES_URL || process.env.SUPABASE_POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ Missing POSTGRES_URL, SUPABASE_POSTGRES_URL or DATABASE_URL in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
    console.log('🚀 Connecting to Database...');
    await client.connect();

    try {
        const sqlPath = path.resolve(__dirname, 'migrations/117_fix_giveaway_rpc_response.sql');
        console.log('Reading migration file:', sqlPath);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📜 Applying Migration 117...');
        await client.query(sql);

        console.log('✅ Migration 117 applied successfully!');
    } catch (err) {
        console.error('❌ Error applying migration:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
