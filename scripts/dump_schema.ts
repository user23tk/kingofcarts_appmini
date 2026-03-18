import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

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
    console.error('Missing SUPABASE_POSTGRES_URL_NON_POOLING');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function dump() {
    await client.connect();
    let markdown = '# Database Schema & Security Dump\n\n';
    try {
        // 1. Get Tables
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
        `);
        const tables = tablesRes.rows.map(r => r.table_name);
        
        for (const table of tables) {
            markdown += `## Table: ${table}\n\n### Columns\n`;
            const colsRes = await client.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position;
            `, [table]);
            
            markdown += '| Column | Type | Nullable | Default |\n';
            markdown += '|---|---|---|---|\n';
            for (const col of colsRes.rows) {
                markdown += `| ${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${col.column_default || 'NULL'} |\n`;
            }
            
            // 2. Get RLS Policies for the table
            const rlsRes = await client.query(`
                SELECT relrowsecurity 
                FROM pg_class 
                WHERE oid = $1::regclass;
            `, [table]);
            const isRlsEnabled = rlsRes.rows.length > 0 ? rlsRes.rows[0].relrowsecurity : false;
            
            markdown += `\n### Security (RLS)\n- **RLS Enabled:** ${isRlsEnabled}\n\n`;
            
            const polRes = await client.query(`
                SELECT policyname, permissive, roles, cmd, qual, with_check 
                FROM pg_policies 
                WHERE schemaname = 'public' AND tablename = $1;
            `, [table]);
            
            if (polRes.rows.length > 0) {
                for (const pol of polRes.rows) {
                    markdown += `#### Policy: ${pol.policyname}\n`;
                    markdown += `- Action: ${pol.cmd}\n`;
                    markdown += `- Roles: ${pol.roles}\n`;
                    markdown += `- USING expression: ${pol.qual || 'N/A'}\n`;
                    markdown += `- WITH CHECK expression: ${pol.with_check || 'N/A'}\n\n`;
                }
            } else {
                markdown += `*No policies defined*\n\n`;
            }
        }
        
        fs.writeFileSync('C:\\Users\\jackot34\\.gemini\\antigravity\\brain\\270852c7-d5ea-46b5-ac09-bad71e1384be\\db_schema.md', markdown);
        console.log('Dump completed successfully.');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

dump();
