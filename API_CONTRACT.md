# CircuitSnips Batch Import API Contract

**For Scraper Implementation**

## Endpoint

```
POST https://circuitsnips.mikeayles.com/api/admin/batch-import
```

## Authentication

Include admin API key in request header:

```
Authorization: Bearer <ADMIN_API_KEY>
```

(API key will be provided separately)

## Request Format

```json
{
  "records": [
    {
      "source_file_id": "string - unique ID from your database",
      "repo_owner": "string - GitHub username/org",
      "repo_name": "string - repository name",
      "repo_url": "string - full GitHub URL",
      "repo_license": "string - SPDX license identifier",
      "file_path": "string - path within repository",
      "raw_sexpr": "string - complete KiCad S-expression",
      "component_count": "number - component count",
      "classification_score": "number - 0-10 quality score",
      "subcircuit": {
        "name": "string - subcircuit name (max 100 chars)",
        "description": "string - what it does",
        "components": "string - optional component list",
        "useCase": "string - optional use case",
        "notes": "string - optional notes",
        "tags": ["array", "of", "strings", "max 10 tags"]
      }
    }
  ]
}
```

## Limits

- **Max records per batch**: 100
- **Title (subcircuit.name)**: 100 characters max
- **Description**: Will be truncated to 1000 chars (including attribution)
- **Tags**: Max 10 tags, each max 30 characters
- **Recommended quality threshold**: classification_score >= 7

## Response Format

```json
{
  "success": true,
  "batch_id": "batch-1706123456789",
  "results": {
    "total": 100,
    "imported": 97,
    "skipped": 2,
    "failed": 1
  },
  "details": [
    {
      "source_file_id": "12345",
      "status": "success",
      "circuit_id": "uuid",
      "slug": "33v-ldo-regulator-esp32-board"
    },
    {
      "source_file_id": "12346",
      "status": "skipped",
      "reason": "Duplicate slug"
    },
    {
      "source_file_id": "12347",
      "status": "error",
      "error": "Invalid S-expression"
    }
  ]
}
```

## Status Codes

- `200 OK` - Batch processed (check individual record statuses in response)
- `400 Bad Request` - Invalid request format or validation errors
- `401 Unauthorized` - Invalid or missing API key
- `500 Internal Server Error` - Server error

## Example SQL Export Query

```sql
SELECT
  f.id AS source_file_id,
  r.owner AS repo_owner,
  r.name AS repo_name,
  r.url AS repo_url,
  r.license AS repo_license,
  f.file_path,
  f.local_path,
  f.component_count,
  f.classification_score,
  f.classification_data
FROM files f
JOIN repositories r ON f.repo_id = r.id
WHERE f.classification_score >= 7
  AND f.classification_data IS NOT NULL
ORDER BY f.classification_score DESC, r.stars DESC;
```

## Mapping Your Data

For each row from the database:

1. Read the schematic file content from `local_path`
2. Parse `classification_data` JSON to get subcircuits array
3. **Create one API record per subcircuit** (not per file)
4. Each subcircuit becomes a separate circuit in CircuitSnips

Example transformation:

```javascript
const classificationData = JSON.parse(row.classification_data);
const rawSexpr = fs.readFileSync(row.local_path, 'utf8');

const apiRecords = classificationData.subcircuits.map(subcircuit => ({
  source_file_id: `${row.source_file_id}-${subcircuit.name}`,
  repo_owner: row.repo_owner,
  repo_name: row.repo_name,
  repo_url: row.repo_url,
  repo_license: row.repo_license,
  file_path: row.file_path,
  raw_sexpr: rawSexpr, // Same file content for all subcircuits
  component_count: row.component_count,
  classification_score: row.classification_score,
  subcircuit: {
    name: subcircuit.name,
    description: subcircuit.description,
    components: subcircuit.components,
    useCase: subcircuit.useCase,
    notes: subcircuit.notes,
    tags: subcircuit.tags
  }
}));
```

## Recommended Import Process

1. **Filter**: Export only records with `classification_score >= 7`
2. **Transform**: Convert each subcircuit to API format
3. **Batch**: Group into batches of 100 records
4. **Send**: POST each batch with retry logic
5. **Log**: Record results for monitoring
6. **Handle errors**: Save failed records for manual review

## Supported Licenses

CircuitSnips supports these SPDX identifiers:
- MIT
- Apache-2.0
- GPL-3.0
- BSD-2-Clause
- CC-BY-4.0
- CC-BY-SA-4.0
- CERN-OHL-S-2.0
- TAPR-OHL-1.0

Unknown licenses will default to CERN-OHL-S-2.0 with a note.

## Attribution

Each imported circuit will automatically include:

**In the description**:
```
---
**Source**: [owner/repo](github-url)
**File**: `path/to/file.kicad_sch`
**License**: [SPDX](link-to-license)
**Quality Score**: X/10
```

**In the S-expression** (embedded as comments):
```scheme
(comment 1 "GitHub: https://github.com/owner/repo")
(comment 2 "Source: owner/repo | path/to/file.kicad_sch")
(comment 3 "License: Apache-2.0 | Quality: 8/10")
(comment 4 "Imported: 2025-01-20 | CircuitSnips.com")
```

## Rate Limiting

Current limits (subject to change):
- 100 records per request
- Recommended: 1 request per second
- Monitor response times and adjust as needed

## Questions?

Contact: (provide contact method)

## Testing

Test endpoint (returns documentation):
```bash
curl https://circuitsnips.mikeayles.com/api/admin/batch-import
```

Test with sample data:
```bash
curl -X POST https://circuitsnips.mikeayles.com/api/admin/batch-import \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"records":[{...}]}'
```
