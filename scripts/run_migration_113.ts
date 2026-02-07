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
            const value = match[2].trim().replace(/^["'](.+)["']$/, '$1');
            process.env[key] = value;
        }
    });
}

const connectionString = process.env.SUPABASE_POSTGRES_URL_NON_POOLING || process.env.SUPABASE_POSTGRES_URL;

if (!connectionString) {
    console.error('❌ Missing SUPABASE_POSTGRES_URL');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    console.log('🚀 Connecting to Database...');
    await client.connect();

    try {
        const sqlPath = path.resolve(__dirname, 'migrations/113_add_deactivate_giveaways.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📜 Applying Migration 113...');
        await client.query(sql);

        console.log('✅ Migration 113 applied successfully!');
    } catch (err) {
        console.error('❌ Error applying migration:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
