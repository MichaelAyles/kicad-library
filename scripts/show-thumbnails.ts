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
        .order('updated_at', { ascending: false })
        .limit(5);

    if (!circuits) {
        console.log('No circuits found');
        return;
    }

    let markdown = '# Recently Generated Thumbnails\n\n';

    for (const circuit of circuits) {
        markdown += `## ${circuit.title}\n\n`;
        markdown += `- **Circuit URL**: https://circuitsnips.com/circuit/${circuit.slug}\n`;
        markdown += `- **Version**: v${circuit.thumbnail_version || 'N/A'}\n`;
        markdown += `- **Light Thumbnail**: ${circuit.thumbnail_light_url || 'N/A'}\n`;
        markdown += `- **Dark Thumbnail**: ${circuit.thumbnail_dark_url || 'N/A'}\n\n`;

        if (circuit.thumbnail_light_url) {
            markdown += `### Light Mode\n![Light thumbnail](${circuit.thumbnail_light_url})\n\n`;
        }

        if (circuit.thumbnail_dark_url) {
            markdown += `### Dark Mode\n![Dark thumbnail](${circuit.thumbnail_dark_url})\n\n`;
        }

        markdown += '---\n\n';
    }

    fs.writeFileSync('generated-thumbnails.md', markdown);
    console.log('✅ Written to generated-thumbnails.md');
}

main();
