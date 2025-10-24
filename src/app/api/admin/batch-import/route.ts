/**
 * Batch Import API Endpoint
 *
 * POST /api/admin/batch-import
 *
 * Imports circuits from external scrapers (GitHub OSHW, etc.)
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyAdminKey } from '@/lib/admin-auth';
import { validateImportBatch, ImportRecord } from '@/lib/batch-import/validator';
import { transformToCircuit } from '@/lib/batch-import/transformer';
import { generateUniqueSlug } from '@/lib/batch-import/slug-generator';
import { addGitHubAttribution } from '@/lib/kicad-parser';

interface ImportResult {
  source_file_id: string;
  status: 'success' | 'skipped' | 'error';
  circuit_id?: string;
  slug?: string;
  reason?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin authentication
    const authHeader = request.headers.get('Authorization');
    if (!verifyAdminKey(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid admin API key' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { records } = body;

    if (!records) {
      return NextResponse.json(
        { error: 'Missing "records" array in request body' },
        { status: 400 }
      );
    }

    // 3. Validate batch
    let validationResults;
    try {
      validationResults = validateImportBatch(records);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // 4. Get bot user ID from environment
    const botUserId = process.env.BOT_USER_ID;
    if (!botUserId) {
      console.error('BOT_USER_ID not configured in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error - BOT_USER_ID not set' },
        { status: 500 }
      );
    }

    // 5. Initialize Supabase client
    const supabase = await createClient();

    // 6. Process each record
    const results: ImportResult[] = [];
    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record: ImportRecord = records[i];
      const validation = validationResults[i];

      // Skip if validation failed
      if (!validation.valid) {
        results.push({
          source_file_id: record.source_file_id || `unknown-${i}`,
          status: 'error',
          error: validation.errors.join(', '),
        });
        failedCount++;
        continue;
      }

      try {
        // Generate unique slug
        const slug = await generateUniqueSlug(
          supabase,
          record.subcircuit.name,
          record.repo_name
        );

        // Add GitHub attribution to S-expression
        const attributedSexpr = addGitHubAttribution(record.raw_sexpr, {
          repoOwner: record.repo_owner,
          repoName: record.repo_name,
          repoUrl: record.repo_url,
          filePath: record.file_path,
          license: record.repo_license,
          score: record.classification_score,
        });

        // Transform to circuit data
        const circuitData = transformToCircuit(
          { ...record, raw_sexpr: attributedSexpr },
          slug,
          botUserId
        );

        // Insert into database
        const { data: insertedCircuit, error: insertError } = await supabase
          .from('circuits')
          .insert(circuitData)
          .select('id, slug')
          .single();

        if (insertError) {
          // Check if it's a duplicate slug error
          if (insertError.code === '23505') {
            results.push({
              source_file_id: record.source_file_id,
              status: 'skipped',
              reason: `Duplicate slug: ${slug}`,
            });
            skippedCount++;
          } else {
            throw insertError;
          }
        } else {
          results.push({
            source_file_id: record.source_file_id,
            status: 'success',
            circuit_id: insertedCircuit.id,
            slug: insertedCircuit.slug,
          });
          importedCount++;
        }
      } catch (error: any) {
        console.error(`Error importing record ${record.source_file_id}:`, error);
        results.push({
          source_file_id: record.source_file_id,
          status: 'error',
          error: error.message || 'Unknown error',
        });
        failedCount++;
      }
    }

    // 7. Return results
    return NextResponse.json({
      success: true,
      batch_id: `batch-${Date.now()}`, // Simple batch ID for now
      results: {
        total: records.length,
        imported: importedCount,
        skipped: skippedCount,
        failed: failedCount,
      },
      details: results,
    });
  } catch (error: any) {
    console.error('Error in batch import:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/admin/batch-import',
    description: 'Batch import circuits from external scrapers',
    authentication: 'Bearer token in Authorization header',
    request_format: {
      records: [
        {
          source_file_id: 'string',
          repo_owner: 'string',
          repo_name: 'string',
          repo_url: 'string',
          repo_license: 'string',
          file_path: 'string',
          raw_sexpr: 'string (KiCad S-expression)',
          component_count: 'number',
          classification_score: 'number (0-10)',
          subcircuit: {
            name: 'string (max 100 chars)',
            description: 'string',
            components: 'string (optional)',
            useCase: 'string (optional)',
            notes: 'string (optional)',
            tags: ['array of strings (max 10, each max 30 chars)'],
          },
        },
      ],
    },
    limits: {
      max_records_per_batch: 100,
      title_max_length: 100,
      description_max_length: 1000,
      tag_max_count: 10,
      tag_max_length: 30,
    },
    response_format: {
      success: 'boolean',
      batch_id: 'string',
      results: {
        total: 'number',
        imported: 'number',
        skipped: 'number',
        failed: 'number',
      },
      details: [
        {
          source_file_id: 'string',
          status: 'success | skipped | error',
          circuit_id: 'string (if success)',
          slug: 'string (if success)',
          reason: 'string (if skipped)',
          error: 'string (if error)',
        },
      ],
    },
  });
}
