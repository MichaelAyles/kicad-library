import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The 2 circuit IDs that were just regenerated
const circuitIds = [
    '1969932d-b922-4e9e-8bf2-f675c8245d19', // v5
    'a5be9bcb-68ab-4cb5-9e00-e520f3accf9e'  // v7
];

async function main() {
    const { data: circuits } = await supabase
        .from('circuits')
        .select('id, slug, title, thumbnail_light_url, thumbnail_dark_url, thumbnail_version, created_at, updated_at')
        .in('id', circuitIds)
        .order('updated_at', { ascending: false });

    if (!circuits || circuits.length === 0) {
        console.log('No circuits found');
        return;
    }

    let markdown = '# Test Thumbnails - 12 Second Wait Time\n\n';
    markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
    markdown += `Total circuits: ${circuits.length}\n\n`;
    markdown += '**Wait Times**: 8s initial + 4s additional = 12s total per circuit\n\n';
    markdown += '**IMPORTANT**: These thumbnails were generated with extended wait times.\n';
    markdown += 'Please verify that you can see actual schematics, not just colored squares.\n\n';
    markdown += '---\n\n';

    for (const circuit of circuits) {
        markdown += `## ${circuit.title}\n\n`;
        markdown += `- **Circuit ID**: \`${circuit.id}\`\n`;
        markdown += `- **Circuit URL**: https://circuitsnips.com/circuit/${circuit.slug}\n`;
        markdown += `- **Thumbnail Version**: v${circuit.thumbnail_version}\n`;
        markdown += `- **Updated**: ${new Date(circuit.updated_at).toLocaleString()}\n\n`;

        // Extract version from URL to verify it matches
        const lightUrlVersion = circuit.thumbnail_light_url?.match(/-v(\d+)-light/)?.[1];
        const darkUrlVersion = circuit.thumbnail_dark_url?.match(/-v(\d+)-dark/)?.[1];

        const versionMatch = lightUrlVersion === circuit.thumbnail_version.toString() &&
                            darkUrlVersion === circuit.thumbnail_version.toString();

        markdown += `- **Version Match**: ${versionMatch ? '✅' : '❌'} (URL v${lightUrlVersion}, DB v${circuit.thumbnail_version})\n\n`;

        if (circuit.thumbnail_light_url) {
            markdown += `### Light Mode\n`;
            markdown += `![Light thumbnail](${circuit.thumbnail_light_url})\n\n`;
            markdown += `<details>\n<summary>URL</summary>\n\n\`\`\`\n${circuit.thumbnail_light_url}\n\`\`\`\n</details>\n\n`;
        }

        if (circuit.thumbnail_dark_url) {
            markdown += `### Dark Mode\n`;
            markdown += `![Dark thumbnail](${circuit.thumbnail_dark_url})\n\n`;
            markdown += `<details>\n<summary>URL</summary>\n\n\`\`\`\n${circuit.thumbnail_dark_url}\n\`\`\`\n</details>\n\n`;
        }

        markdown += '---\n\n';
    }

    // Summary
    markdown += '## Verification Checklist\n\n';
    markdown += '- [ ] Both thumbnails show actual schematics (not colored squares)\n';
    markdown += '- [ ] Components and wires are visible\n';
    markdown += '- [ ] Text labels are readable\n';
    markdown += '- [ ] Light mode has appropriate background\n';
    markdown += '- [ ] Dark mode has appropriate background\n';
    markdown += '- [ ] No excessive white space (cropped properly)\n';
    markdown += '- [ ] Aspect ratio looks correct (800x566)\n';
    markdown += '- [ ] Version numbers match in URLs and database\n\n';

    const allVersionsMatch = circuits.every(c => {
        const lightUrlVersion = c.thumbnail_light_url?.match(/-v(\d+)-light/)?.[1];
        const darkUrlVersion = c.thumbnail_dark_url?.match(/-v(\d+)-dark/)?.[1];
        return lightUrlVersion === c.thumbnail_version.toString() &&
               darkUrlVersion === c.thumbnail_version.toString();
    });

    markdown += `**All versions match**: ${allVersionsMatch ? '✅ YES' : '❌ NO'}\n\n`;

    fs.writeFileSync('test-thumbnails-fixed.md', markdown);
    console.log('✅ Written to test-thumbnails-fixed.md');
    console.log(`\nPreview the file to verify schematics are visible!`);
}

main();
