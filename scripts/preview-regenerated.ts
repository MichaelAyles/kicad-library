import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The 10 circuit IDs that were just regenerated
const circuitIds = [
    '1969932d-b922-4e9e-8bf2-f675c8245d19', // v3
    'a5be9bcb-68ab-4cb5-9e00-e520f3accf9e', // v5
    'a898a182-f319-452e-803e-c4a950dddb96', // v3
    '727628a9-8cd4-4923-93bd-35194a335f20', // v3
    'ee522b77-1bb3-4509-ba12-d869cd731e42', // v3
    'b42e45d5-8ae2-46cc-a4e5-95901dfbbb62', // v2
    'b713e677-2d98-4fe3-9ea0-88ae90b961d5', // v2
    '8a5e57cb-9fc0-4112-a4dc-c1c43bb24a9f', // v2
    '524cca5b-97b5-4ed1-8bca-9c6138223de4', // v2
    '6ab7b456-b94f-4769-9263-32448b68b95d'  // v2
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

    let markdown = '# Regenerated Thumbnails Preview\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `Total circuits regenerated: ${circuits.length}\n\n`;
    markdown += '---\n\n';

    for (const circuit of circuits) {
        markdown += `## ${circuit.title}\n\n`;
        markdown += `- **Circuit ID**: \`${circuit.id}\`\n`;
        markdown += `- **Circuit URL**: https://circuitsnips.com/circuit/${circuit.slug}\n`;
        markdown += `- **Thumbnail Version**: v${circuit.thumbnail_version}\n`;
        markdown += `- **Created**: ${new Date(circuit.created_at).toLocaleString()}\n`;
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
            markdown += `URL: \`${circuit.thumbnail_light_url}\`\n\n`;
        } else {
            markdown += `### Light Mode\n❌ No thumbnail URL\n\n`;
        }

        if (circuit.thumbnail_dark_url) {
            markdown += `### Dark Mode\n`;
            markdown += `![Dark thumbnail](${circuit.thumbnail_dark_url})\n\n`;
            markdown += `URL: \`${circuit.thumbnail_dark_url}\`\n\n`;
        } else {
            markdown += `### Dark Mode\n❌ No thumbnail URL\n\n`;
        }

        markdown += '---\n\n';
    }

    // Summary
    markdown += '## Summary\n\n';
    const allVersionsMatch = circuits.every(c => {
        const lightUrlVersion = c.thumbnail_light_url?.match(/-v(\d+)-light/)?.[1];
        const darkUrlVersion = c.thumbnail_dark_url?.match(/-v(\d+)-dark/)?.[1];
        return lightUrlVersion === c.thumbnail_version.toString() &&
               darkUrlVersion === c.thumbnail_version.toString();
    });

    markdown += `- Total circuits: ${circuits.length}\n`;
    markdown += `- All versions match: ${allVersionsMatch ? '✅ YES' : '❌ NO'}\n`;
    markdown += `- All have light thumbnails: ${circuits.every(c => c.thumbnail_light_url) ? '✅ YES' : '❌ NO'}\n`;
    markdown += `- All have dark thumbnails: ${circuits.every(c => c.thumbnail_dark_url) ? '✅ YES' : '❌ NO'}\n\n`;

    markdown += '## Visual Inspection Checklist\n\n';
    markdown += '- [ ] Thumbnails are properly cropped (no excessive white space)\n';
    markdown += '- [ ] Aspect ratio is consistent (400x300)\n';
    markdown += '- [ ] Light mode thumbnails have white/light backgrounds\n';
    markdown += '- [ ] Dark mode thumbnails have dark backgrounds\n';
    markdown += '- [ ] All circuit elements are visible and not cut off\n';
    markdown += '- [ ] Version numbers in URLs match database version numbers\n';
    markdown += '- [ ] Images load correctly in the preview\n\n';

    fs.writeFileSync('regenerated-preview.md', markdown);
    console.log('✅ Written to regenerated-preview.md');
    console.log(`\nPreview ${circuits.length} circuits with version verification`);
    console.log(`All versions match: ${allVersionsMatch ? '✅' : '❌'}`);
}

main();
