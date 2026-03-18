const { Client } = require('pg');
const fs = require('fs');

// Read .env.local manually
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] ? match[2].trim() : '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
} catch (e) {
  console.log("Could not read .env.local completely, will try to proceed with existing env vars");
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const dbUrl = process.env.DATABASE_URL || 
                process.env.POSTGRES_URL || 
                process.env.SUPABASE_POSTGRES_PRISMA_URL ||
                process.env.SUPABASE_POSTGRES_URL;
                
  if (!dbUrl) {
    console.error("No direct postgres connection string found. Cannot run raw SQL reliably without pg connection.");
    // Fallback: let's create a temporary RPC function using the REST api to execute raw sql, or try to run via psql if possible.
    return;
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL");
    
    const queries = [
      "DROP POLICY IF EXISTS global_stats_all_operations ON global_stats;",
      "DROP POLICY IF EXISTS user_progress_all_operations ON user_progress;",
      "DROP POLICY IF EXISTS users_all_operations ON users;",
      "DROP POLICY IF EXISTS generated_chapters_all_operations ON generated_chapters;",
      "DROP POLICY IF EXISTS themes_all_operations ON themes;",
      "DROP POLICY IF EXISTS story_chapters_all_operations ON story_chapters;",
      "DROP POLICY IF EXISTS rate_limits_all_operations ON rate_limits;",
      "DROP POLICY IF EXISTS security_events_all_operations ON security_events;",
      
      "DROP TABLE IF EXISTS user_progress_backup;",
      "DROP TABLE IF EXISTS user_progress_backup_110;",
      "DROP TABLE IF EXISTS user_progress_backup_112;",
      "DROP TABLE IF EXISTS event_leaderboard_backup;"
    ];

    for (const q of queries) {
      console.log(`Executing: ${q}`);
      await client.query(q);
      console.log("Success");
    }

  } catch (err) {
    console.error("Error executing queries:", err);
  } finally {
    await client.end();
  }
}

main();
