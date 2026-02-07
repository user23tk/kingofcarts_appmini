import { createClient } from '@supabase/supabase-js';
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
} else {
    console.warn("⚠️ .env.local not found at " + envPath);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

// Create Supabase client with Service Role Key (Admin)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runTests() {
    console.log('🚀 Starting Schema Verification Tests...\n');
    let passed = 0;
    let failed = 0;

    // TEST 1: Check Core Tables
    console.log('Test 1: Core Tables Existence');
    const tables = ['users', 'user_progress', 'themes', 'story_chapters', 'events', 'giveaways'];

    for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error && error.code !== 'PGRST116') { // PGRST116 is just no rows, checking if table exists
            console.log(`  ❌ Table '${table}': ERROR (${error.message})`);
            failed++;
        } else {
            console.log(`  ✅ Table '${table}': OK`);
        }
    }
    passed++;


    // TEST 2: Check RPC: get_active_event
    console.log('\nTest 2: RPC get_active_event()');
    const { data: activeEvent, error: rpcError } = await supabase.rpc('get_active_event');

    if (rpcError) {
        console.log(`  ❌ get_active_event failed: ${rpcError.message}`);
        failed++;
    } else {
        console.log(`  ✅ get_active_event response:`, activeEvent ? 'Active event found' : 'No active event (OK)');
        passed++;
    }

    // TEST 3: Check RPC: get_leaderboard
    console.log('\nTest 3: RPC get_leaderboard()');
    const { data: leaderboard, error: lbError } = await supabase.rpc('get_leaderboard', { limit_count: 1 });

    if (lbError) {
        console.log(`  ❌ get_leaderboard failed: ${lbError.message}`);
        failed++;
    } else {
        console.log(`  ✅ get_leaderboard OK. Entries: ${leaderboard?.length || 0}`);
        passed++;
    }

    // TEST 4: Check Giveaway Tables
    console.log('\nTest 4: Giveaway System');
    const { error: gwError } = await supabase.from('giveaways').select('count');
    if (gwError) {
        console.log(`  ❌ Giveaways table access failed: ${gwError.message}`);
        failed++;
    } else {
        console.log('  ✅ Giveaways table access OK');

        // Check ticket functions existence by calling with dummy UUID
        const dummyId = '00000000-0000-0000-0000-000000000000';
        const { error: calcError } = await supabase.rpc('calculate_user_tickets', {
            p_user_id: dummyId,
            p_giveaway_id: dummyId
        });

        // We expect "Giveaway not found" or success: false, NOT a db error like "function does not exist"
        if (calcError && calcError.message.includes('function') && calcError.message.includes('does not exist')) {
            console.log(`  ❌ calculate_user_tickets function MISSING: ${calcError.message}`);
            failed++;
        } else {
            console.log('  ✅ calculate_user_tickets function exists');
            passed++;
        }
    }

    // TEST 5: Security Tables
    console.log('\nTest 5: Security Tables');
    const { error: auditError } = await supabase.from('audit_logs').select('count');
    if (auditError) {
        console.log(`  ❌ audit_logs table access failed: ${auditError.message}`);
        failed++;
    } else {
        console.log('  ✅ audit_logs table access OK');
        passed++;
    }

    // TEST 6: Event specific RPCs (Phase 2)
    console.log('\nTest 6: Event RPCs (Phase 2)');

    // 6.1 deactivate_expired_events
    const { data: deactivatedCount, error: deactivateError } = await supabase.rpc('deactivate_expired_events');
    if (deactivateError) {
        console.log(`  ❌ deactivate_expired_events failed: ${deactivateError.message}`);
        failed++;
    } else {
        console.log(`  ✅ deactivate_expired_events OK. Deactivated: ${deactivatedCount}`);
        passed++;
    }

    // 6.2 get_event_leaderboard_v2
    const { data: eventLb, error: eventLbError } = await supabase.rpc('get_event_leaderboard_v2', {
        p_theme: 'fantasy', // Dummy theme
        p_limit: 1
    });
    if (eventLbError) {
        console.log(`  ❌ get_event_leaderboard_v2 failed: ${eventLbError.message}`);
        failed++;
    } else {
        console.log(`  ✅ get_event_leaderboard_v2 OK. Entries: ${eventLb?.length || 0}`);
        passed++;
    }

    // 6.3 create_event_giveaway (Phase 3)
    console.log('\nTest 7: Event-Giveaway Connection (Phase 3)');

    // Setup dummy data
    const dummyThemeName = 'test_theme_' + Date.now();
    const { data: themeData, error: themeError } = await supabase.from('themes').insert({
        name: dummyThemeName,
        title: 'Test Theme',
        is_event: true,
        is_active: true,
        event_start_date: new Date().toISOString(),
        event_end_date: new Date(Date.now() + 86400000).toISOString()
    }).select().single();

    if (themeError) {
        console.log(`  ⚠️ Setup failed (Theme): ${themeError.message}`);
        failed++;
    } else {
        // Create dummy user and leaderboard entry
        const dummyUserId = '00000000-0000-0000-0000-000000000000'; // Assuming this might fail if FK constraint, but let's try or just use existing user if any
        // Better to check if users exist
        const { data: users } = await supabase.from('users').select('id').limit(1);
        const targetUserId = users && users.length > 0 ? users[0].id : null;

        if (targetUserId) {
            await supabase.from('event_leaderboard').insert({
                user_id: targetUserId,
                theme: dummyThemeName,
                total_pp: 100,
                chapters_completed: 5
            });

            // Call RPC
            const { data: gwData, error: gwError } = await supabase.rpc('create_event_giveaway', {
                p_theme_id: themeData.id,
                p_prize_title: 'Test Prize',
                p_top_n: 5
            });

            if (gwError) {
                console.log(`  ❌ create_event_giveaway failed: ${gwError.message}`);
                failed++;
            } else {
                if (gwData.success) {
                    console.log(`  ✅ create_event_giveaway OK. Created Giveaway ID: ${gwData.giveaway_id}, Entries: ${gwData.entries_created}`);
                    passed++;
                } else {
                    console.log(`  ❌ create_event_giveaway returned false: ${gwData.error}`);
                    failed++;
                }
            }
        } else {
            console.log('  ⚠️ Skipping create_event_giveaway test (No users found)');
        }
    }

    console.log('\n-----------------------------------');
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);

    if (failed > 0) {
        console.log('⚠️  Some tests failed. Please review the schema.');
        process.exit(1);
    } else {
        console.log('🎉 All schema verification tests passed!');
    }
}

runTests().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
