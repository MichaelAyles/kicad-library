import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://trjytrpqmfurirdaxlnr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyanl0cnBxbWZ1cmlyZGF4bG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NjQ4OTIsImV4cCI6MjA3NjI0MDg5Mn0.wUBXbr6Dke71CKHE8eNAhEbv95SGn3kwkEP5DwoAFik'
);

async function findBadSlugs() {
  const { data, error } = await supabase
    .from('circuits')
    .select('slug, title, created_at')
    .ilike('slug', '%.kicad_sch');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\nFound ${data.length} circuits with .kicad_sch in their slug:\n`);
  data.forEach(c => {
    const correctSlug = c.slug.replace(/\.kicad_sch$/, '');
    console.log(`❌ ${c.slug}`);
    console.log(`   → Should be: ${correctSlug}`);
    console.log(`   Title: ${c.title}`);
    console.log(`   Created: ${new Date(c.created_at).toISOString().split('T')[0]}\n`);
  });

  if (data.length === 0) {
    console.log('No circuits found with .kicad_sch in slug');
  }
}

findBadSlugs();
