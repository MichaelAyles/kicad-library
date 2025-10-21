import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get total circuit count
    const { count: circuitCount, error: circuitError } = await supabase
      .from('circuits')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true);

    if (circuitError) throw circuitError;

    // Get total copies (sum of all copy_count)
    const { data: copiesData, error: copiesError } = await supabase
      .from('circuits')
      .select('copy_count')
      .eq('is_public', true);

    if (copiesError) throw copiesError;

    const totalCopies = copiesData?.reduce((sum, circuit) => sum + (circuit.copy_count || 0), 0) || 0;

    // Get unique user count (makers)
    const { count: makerCount, error: makerError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (makerError) throw makerError;

    return NextResponse.json({
      circuits: circuitCount || 0,
      copies: totalCopies,
      makers: makerCount || 0,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
