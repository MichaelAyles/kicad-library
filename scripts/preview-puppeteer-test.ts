import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const { data: circuits } = await supabase
        .from('circuits')
        .select('id, slug, title, thumbnail_light_url, thumbnail_dark_url, thumbnail_version')
        .eq('id', '1969932d-b922-4e9e-8bf2-f675c8245d19');

    if (!circuits || circuits.length === 0) {
        console.log('Circuit not found');
        return;
    }

    const circuit = circuits[0];

    let markdown = '# Puppeteer Screenshot Test - UI Hidden\n\n';
    markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
    markdown += '**Method**: Puppeteer.element.screenshot() with UI elements hidden and transparent background\n\n';
    markdown += '---\n\n';

    markdown += `## ${circuit.title}\n\n`;
    markdown += `- **Circuit URL**: https://circuitsnips.com/circuit/${circuit.slug}\n`;
    markdown += `- **Version**: v${circuit.thumbnail_version}\n\n`;

    markdown += `### Light Thumbnail\n`;
    markdown += `![Light](${circuit.thumbnail_light_url})\n\n`;
    markdown += `URL: ${circuit.thumbnail_light_url}\n\n`;

    markdown += `### Dark Thumbnail\n`;
    markdown += `![Dark](${circuit.thumbnail_dark_url})\n\n`;
    markdown += `URL: ${circuit.thumbnail_dark_url}\n\n`;

    markdown += '---\n\n## Check\n\n';
    markdown += '- [ ] Can you see an actual schematic (not colored squares)?\n';
    markdown += '- [ ] Does it show components and wires?\n';

    fs.writeFileSync('puppeteer-test.md', markdown);
    console.log('✅ Written to puppeteer-test.md');
}

main();
