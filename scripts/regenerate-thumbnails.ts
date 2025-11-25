
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

// Initialize Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const RENDERER_URL = 'http://localhost:3006/thumbnail-renderer';
const BATCH_SIZE = 50; // Process in small batches to manage memory

// Parse command line arguments
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;

async function main() {
    console.log('🚀 Starting Thumbnail Regeneration Script');
    if (LIMIT !== Infinity) console.log(`Limit: ${LIMIT} circuits`);
    console.log('----------------------------------------');

    // 1. Launch Puppeteer with GPU enabled for WebGL
    console.log('launching browser with GPU support...');
    const browser = await puppeteer.launch({
        headless: true, // Use headless mode
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer', // Use GPU
            '--enable-webgl',
            '--enable-accelerated-2d-canvas',
            '--ignore-gpu-blocklist'
        ],
        protocolTimeout: 120000 // 2 minutes timeout
    });
    const page = await browser.newPage();

    // Enable console logging from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // 2. Navigate to renderer page
    console.log(`Navigating to ${RENDERER_URL}...`);
    try {
        await page.goto(RENDERER_URL, { waitUntil: 'networkidle0' });
        console.log('Renderer page loaded');
    } catch (e) {
        console.error(`Failed to load ${RENDERER_URL}. Make sure your local server is running (npm run dev).`);
        console.error('Error:', e);
        await browser.close();
        process.exit(1);
    }

    // 3. Fetch all circuits
    console.log('Fetching circuits from database...');

    const { count } = await supabase.from('circuits').select('*', { count: 'exact', head: true });
    console.log(`Total circuits found: ${count}`);

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    // Process in chunks
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
        const { data: circuits, error } = await supabase
            .from('circuits')
            .select('id, user_id, raw_sexpr, thumbnail_version')
            .order('created_at', { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
            console.error('Error fetching batch:', error);
            break;
        }

        if (!circuits || circuits.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Processing batch ${offset} - ${offset + circuits.length}...`);

        for (const circuit of circuits) {
            if (processedCount >= LIMIT) {
                hasMore = false;
                break;
            }

            processedCount++;
            const { id, user_id, raw_sexpr } = circuit;

            if (!raw_sexpr) {
                console.log(`[${processedCount}/${count}] ⚠️  Skipping ${id} (No raw_sexpr)`);
                skipCount++;
                continue;
            }

            // Validate sexpr roughly
            if (!raw_sexpr.trim().startsWith('(')) {
                console.log(`[${processedCount}/${count}] ⚠️  Skipping ${id} (Invalid sexpr)`);
                skipCount++;
                continue;
            }

            try {
                // Load the circuit into the renderer
                await page.evaluate(async (sexpr: string) => {
                    // Create blob URL for the circuit
                    const blob = new Blob([sexpr], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);

                    // Trigger render by dispatching a custom event
                    window.dispatchEvent(new CustomEvent('loadCircuit', { detail: { url } }));
                }, raw_sexpr);

                // Wait for KiCanvas to load and render
                console.log('Waiting 12s for KiCanvas to render...');
                await new Promise(r => setTimeout(r, 12000));

                // Hide all page UI elements before screenshot
                await page.evaluate(() => {
                    // Hide cookie notice, error badges, etc.
                    const hideSelectors = [
                        '[class*="cookie"]',
                        '[class*="Cookie"]',
                        '[id*="cookie"]',
                        '[class*="error"]',
                        '[class*="Error"]',
                        'header',
                        'footer',
                        'h1',
                        'h2'
                    ];

                    hideSelectors.forEach(selector => {
                        document.querySelectorAll(selector).forEach(el => {
                            (el as HTMLElement).style.display = 'none';
                        });
                    });

                    // Set the body background to transparent
                    document.body.style.background = 'transparent';
                    const container = document.querySelector('[class*="container"]');
                    if (container) {
                        (container as HTMLElement).style.background = 'transparent';
                        (container as HTMLElement).style.padding = '0';
                    }
                });

                // Take screenshot of the kicanvas element using Puppeteer
                const kicanvasSelector = 'kicanvas-embed';
                const element = await page.$(kicanvasSelector);

                if (!element) {
                    throw new Error('KiCanvas element not found');
                }

                // Take screenshot as PNG buffer with transparent background
                const screenshot = await element.screenshot({
                    type: 'png',
                    omitBackground: true  // Transparent background
                });
                const base64 = `data:image/png;base64,${Buffer.from(screenshot).toString('base64')}`;

                // For now, use the same screenshot for both light and dark
                // (We'll generate light from dark using color inversion later)
                const result = { light: base64, dark: base64 };

                // Upload to Storage
                const newVersion = (circuit.thumbnail_version || 0) + 1;
                const lightUrl = await uploadThumbnail(user_id, id, 'light', result.light, newVersion);
                const darkUrl = await uploadThumbnail(user_id, id, 'dark', result.dark, newVersion);

                // Update Database
                const { error: updateError } = await supabase
                    .from('circuits')
                    .update({
                        thumbnail_light_url: lightUrl,
                        thumbnail_dark_url: darkUrl,
                        thumbnail_version: newVersion
                    })
                    .eq('id', id);

                if (updateError) throw updateError;

                console.log(`[${processedCount}/${count}] ✅ Success: ${id} (v${newVersion})`);
                successCount++;

            } catch (err: any) {
                console.error(`[${processedCount}/${count}] ❌ Failed: ${id}`, err.message);
                errorCount++;
            }
        }

        offset += BATCH_SIZE;

        // Optional: Force garbage collection in browser every few batches
        if (offset % 100 === 0) {
            await page.evaluate(() => {
                if (window.gc) window.gc();
            });
        }
    }

    console.log('----------------------------------------');
    console.log('Regeneration Complete!');
    console.log(`Total: ${processedCount}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log(`Skipped: ${skipCount}`);

    await browser.close();
}

// Helper to upload base64 to Supabase Storage
async function uploadThumbnail(userId: string, circuitId: string, theme: 'light' | 'dark', base64Data: string, version: number) {
    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64String, 'base64');
    const filePath = `${userId}/${circuitId}-v${version}-${theme}.png`;

    const { error } = await supabase.storage
        .from('thumbnails')
        .upload(filePath, buffer, {
            contentType: 'image/png',
            upsert: true
        });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const { data } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(filePath);

    return data.publicUrl;
}

main().catch(console.error);
