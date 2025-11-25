import { createClient } from '@supabase/supabase-js';
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

const TEST_COUNT = 10;

interface CircuitInfo {
    id: string;
    slug: string;
    title: string;
    light_url: string;
    dark_url: string;
    version: number;
}

async function main() {
    console.log('📊 Generating Thumbnail Report');
    console.log('================================\n');

    // Get 10 random circuits that already have thumbnails
    console.log('📋 Fetching 10 random circuits with thumbnails...');
    const { data: circuits, error: fetchError } = await supabase
        .from('circuits')
        .select('id, slug, title, thumbnail_light_url, thumbnail_dark_url, thumbnail_version')
        .eq('is_public', true)
        .not('thumbnail_light_url', 'is', null)
        .not('thumbnail_dark_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(TEST_COUNT);

    if (fetchError || !circuits || circuits.length === 0) {
        console.error('❌ Failed to fetch circuits:', fetchError);
        process.exit(1);
    }

    console.log(`✅ Found ${circuits.length} circuits\n`);

    const results: CircuitInfo[] = circuits.map(c => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        light_url: c.thumbnail_light_url,
        dark_url: c.thumbnail_dark_url,
        version: c.thumbnail_version || 1,
    }));

    // Generate markdown report
    console.log('📝 Generating markdown report...');

    let markdown = '# Thumbnail Report - Current Production Thumbnails\n\n';
    markdown += `**Date:** ${new Date().toISOString()}\n`;
    markdown += `**Circuits:** ${results.length}\n\n`;
    markdown += '> This report shows the current thumbnails in production to verify the KiCanvas render event integration.\n\n';
    markdown += '---\n\n';

    for (const result of results) {
        markdown += `## ${result.title}\n\n`;
        markdown += `- **Link:** [View on CircuitSnips](https://circuitsnips.com/circuit/${result.slug})\n`;
        markdown += `- **Version:** v${result.version}\n\n`;
        markdown += `### Light Mode\n\n`;
        markdown += `![Light Thumbnail](${result.light_url}?v=${Date.now()})\n\n`;
        markdown += `### Dark Mode\n\n`;
        markdown += `![Dark Thumbnail](${result.dark_url}?v=${Date.now()})\n\n`;
        markdown += `---\n\n`;
    }

    const reportPath = 'thumbnail-report.md';
    fs.writeFileSync(reportPath, markdown);

    console.log(`\n✅ Report saved to: ${reportPath}`);
    console.log('🎉 Done!');
}

main().catch(console.error);
