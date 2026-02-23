
import fs from 'fs';
import path from 'path';
import { generateImage, getImageModel } from '../lib/ai/nanogpt-client';

function loadEnv() {
    try {
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            envContent.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    process.env[key] = value;
                }
            });
            console.log('Loaded .env.local');
        } else {
            console.warn('.env.local not found at', envPath);
        }
    } catch (e) {
        console.error('Error loading .env.local', e);
    }
}

async function testConcurrency() {
    loadEnv();
    if (!process.env.NANOGPT_API_KEY) {
        console.error('CRITICAL: NANOGPT_API_KEY is missing!');
        process.exit(1);
    }

    console.log('\n--- Testing Parallel Image Generation (3 images) ---');
    const prompts = [
        "Cyberpunk city street 1",
        "Cyberpunk city street 2",
        "Cyberpunk city street 3"
    ];

    try {
        const promises = prompts.map((p, i) => {
            console.log(`Starting image ${i + 1}...`);
            return generateImage({
                prompt: p,
                model: getImageModel(),
                size: "1024x1024"
            }).then(res => {
                console.log(`Image ${i + 1} DONE`);
                return res;
            }).catch(e => {
                console.error(`Image ${i + 1} FAILED:`, e.message);
                return null;
            });
        });

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r).length;
        console.log(`\nResults: ${successCount}/${prompts.length} succeeded`);

    } catch (e: any) {
        console.error('Concurrency Test Failed:', e);
    }
}

testConcurrency();
