import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manually load .env.local
const envPath = path.resolve(__dirname, '../../.env.local');
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Env Vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
    console.log('🚀 Running migration 113...');
    const sqlPath = path.join(__dirname, '113_add_deactivate_giveaways.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }); // Try RPC first if enabled? No, usually not.
    // Actually supabase-js doesn't support raw SQL query directly on client unless we have a function for it.
    // But wait, apply_schema.ts usually works by ... how?
    // Let's check apply_schema.ts technique.
    // It probably uses a special connection or just splits statements.
    // Ah, apply_schema.ts likely uses a postgres client directly or a specific setup.
    // Let's just use the logic from apply_schema.ts but for this file.

    // Fallback: If we can't run raw SQL, we might need 'postgres' package.
    // But since apply_schema.ts exists, let's assume it has the logic.
    // I will look at apply_schema.ts first.
}
// IGNORE THE ABOVE CODE, I WILL READ apply_schema.ts FIRST
