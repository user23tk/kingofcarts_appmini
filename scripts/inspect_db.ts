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
    console.error('❌ Missing SUPABASE_POSTGRES_URL_NON_POOLING or SUPABASE_POSTGRES_URL');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    await client.connect();
    try {
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
        console.log('Users Table Columns:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspect();
