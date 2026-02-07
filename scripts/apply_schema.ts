import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Manually load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["'](.+)["']$/, '$1'); // Remove quotes
            process.env[key] = value;
        }
    });
}

const connectionString = process.env.SUPABASE_POSTGRES_URL_NON_POOLING || process.env.SUPABASE_POSTGRES_URL;

if (!connectionString) {
    console.error('❌ Missing SUPABASE_POSTGRES_URL_NON_POOLING or SUPABASE_POSTGRES_URL in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase/Vercel
});

async function applySchema() {
    console.log('🚀 Connecting to Database...');
    await client.connect();

    try {
        const schemaPath = path.resolve(__dirname, 'migrations/00_COMPLETE_SCHEMA.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('📜 Applying Schema from 00_COMPLETE_SCHEMA.sql...');

        // Split by statement if needed, or run as one block. pg allows multi string.
        await client.query(schemaSql);

        console.log('✅ Schema applied successfully!');
    } catch (err) {
        console.error('❌ Error applying schema:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applySchema();
