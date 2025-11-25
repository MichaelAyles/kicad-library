import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import * as dotenv from 'dotenv';
import fs from 'fs';

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

const RENDERER_URL = 'http://localhost:3007/thumbnail-renderer';
const TEST_COUNT = 10;

interface CircuitInfo {
    id: string;
    slug: string;
    title: string;
    light_url: string;
    dark_url: string;
}

async function uploadThumbnail(
    userId: string,
    circuitId: string,
    theme: 'light' | 'dark',
    dataURL: string,
    version: number
): Promise<string> {
    // Convert base64 to blob
    const arr = dataURL.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });

    const fileName = `${userId}/${circuitId}-v${version}-${theme}.png`;

    const { data, error } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, blob, {
            contentType: 'image/png',
            upsert: true,
        });

    if (error) {
        throw new Error(`Failed to upload ${theme} thumbnail: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

async function main() {
    console.log('🧪 Testing Thumbnail Regeneration with kicanvas:render event');
    console.log('================================================================\n');

    // 1. Get 10 random circuits
    console.log('📋 Fetching 10 random circuits from database...');
    const { data: circuits, error: fetchError } = await supabase
        .from('circuits')
        .select('id, slug, title, user_id, thumbnail_version')
        .eq('is_public', true)
        .limit(TEST_COUNT);

    if (fetchError || !circuits || circuits.length === 0) {
        console.error('❌ Failed to fetch circuits:', fetchError);
        process.exit(1);
    }

    console.log(`✅ Found ${circuits.length} circuits\n`);

    // 2. Launch Puppeteer
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer',
            '--enable-webgl',
            '--enable-accelerated-2d-canvas',
        ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });

    const results: CircuitInfo[] = [];

    // 3. Process each circuit
    for (let i = 0; i < circuits.length; i++) {
        const circuit = circuits[i];
        const { id, slug, title, user_id, thumbnail_version } = circuit;

        console.log(`\n[${i + 1}/${circuits.length}] Processing: ${title}`);
        console.log(`   Slug: ${slug}`);

        try {
            // Navigate to renderer
            const rendererUrl = `${RENDERER_URL}?circuitId=${id}`;
            console.log(`   📍 Loading: ${rendererUrl}`);

            const startTime = Date.now();
            await page.goto(rendererUrl, { waitUntil: 'networkidle0', timeout: 30000 });

            // Wait for thumbnails to be ready
            await page.waitForSelector('#thumbnails-ready', { timeout: 30000 });
            const loadTime = Date.now() - startTime;
            console.log(`   ⏱️  Loaded in ${loadTime}ms`);

            // Get the thumbnail data URLs
            const thumbnails = await page.evaluate(() => {
                const lightImg = document.querySelector('#light-thumbnail') as HTMLImageElement;
                const darkImg = document.querySelector('#dark-thumbnail') as HTMLImageElement;
                return {
                    light: lightImg?.src || '',
                    dark: darkImg?.src || '',
                };
            });

            if (!thumbnails.light || !thumbnails.dark) {
                throw new Error('Failed to capture thumbnails');
            }

            console.log(`   ✅ Thumbnails captured`);

            // Upload thumbnails
            const newVersion = (thumbnail_version || 0) + 1;
            const lightUrl = await uploadThumbnail(user_id, id, 'light', thumbnails.light, newVersion);
            const darkUrl = await uploadThumbnail(user_id, id, 'dark', thumbnails.dark, newVersion);

            console.log(`   📤 Uploaded to Supabase (v${newVersion})`);

            // Update database
            const { error: updateError } = await supabase
                .from('circuits')
                .update({
                    thumbnail_light: lightUrl,
                    thumbnail_dark: darkUrl,
                    thumbnail_version: newVersion,
                })
                .eq('id', id);

            if (updateError) {
                throw new Error(`DB update failed: ${updateError.message}`);
            }

            console.log(`   💾 Database updated`);

            results.push({
                id,
                slug,
                title,
                light_url: lightUrl,
                dark_url: darkUrl,
            });

        } catch (err) {
            console.error(`   ❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }

    await browser.close();

    // 4. Generate markdown report
    console.log('\n\n📝 Generating markdown report...');

    let markdown = '# Thumbnail Regeneration Test Results\n\n';
    markdown += `**Date:** ${new Date().toISOString()}\n`;
    markdown += `**Circuits Processed:** ${results.length}/${TEST_COUNT}\n\n`;
    markdown += '---\n\n';

    for (const result of results) {
        markdown += `## ${result.title}\n\n`;
        markdown += `**Link:** [View on CircuitSnips](https://circuitsnips.com/circuit/${result.slug})\n\n`;
        markdown += `### Light Mode\n`;
        markdown += `![Light Thumbnail](${result.light_url})\n\n`;
        markdown += `### Dark Mode\n`;
        markdown += `![Dark Thumbnail](${result.dark_url})\n\n`;
        markdown += `---\n\n`;
    }

    const reportPath = 'thumbnail-test-report.md';
    fs.writeFileSync(reportPath, markdown);

    console.log(`✅ Report saved to: ${reportPath}`);
    console.log('\n🎉 Test complete!');
}

main().catch(console.error);
