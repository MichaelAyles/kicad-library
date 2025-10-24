import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://trjytrpqmfurirdaxlnr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyanl0cnBxbWZ1cmlyZGF4bG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NjQ4OTIsImV4cCI6MjA3NjI0MDg5Mn0.wUBXbr6Dke71CKHE8eNAhEbv95SGn3kwkEP5DwoAFik'
);

async function checkSlugs() {
  const { data, error } = await supabase
    .from('circuits')
    .select('slug, title, created_at')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('\nRecent circuits (', data.length, 'total):');
  console.log('='.repeat(80));

  data.forEach(c => {
    const hasKicadExt = c.slug.endsWith('.kicad_sch');
    const marker = hasKicadExt ? '❌ BAD' : '✓ OK ';
    const date = new Date(c.created_at).toISOString().split('T')[0];
    console.log(`${marker} | ${date} | ${c.slug}`);
  });

  const badSlugs = data.filter(c => c.slug.endsWith('.kicad_sch'));
  console.log('\n' + '='.repeat(80));
  console.log(`Found ${badSlugs.length} circuits with .kicad_sch in slug`);

  if (badSlugs.length > 0) {
    console.log('\nCircuits with bad slugs:');
    badSlugs.forEach(c => {
      console.log(`  - ${c.slug} (should be: ${c.slug.replace('.kicad_sch', '')})`);
    });
  }
}

checkSlugs();
