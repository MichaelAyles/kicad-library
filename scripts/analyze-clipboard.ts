#!/usr/bin/env npx tsx
/**
 * Static Analysis Tool for KiCad Clipboard Data
 *
 * Analyzes clipboard output to identify formatting issues,
 * missing elements, and potential causes of KiCad crashes.
 *
 * Usage: npx tsx scripts/analyze-clipboard.ts <file>
 */

import * as fs from 'fs';
import * as path from 'path';

interface AnalysisResult {
  file: string;
  size: number;
  lines: number;
  avgCharsPerLine: number;

  // Element counts
  libSymbolDefs: number;      // Symbol definitions in lib_symbols
  symbolInstances: number;    // Placed symbol instances (with lib_id)
  wires: number;
  buses: number;
  junctions: number;
  noConnects: number;
  labels: number;
  globalLabels: number;
  hierarchicalLabels: number;
  text: number;
  polylines: number;
  rectangles: number;
  circles: number;
  arcs: number;

  // Structure analysis
  parenBalance: number;       // Should be 0
  topLevelElements: string[];

  // Formatting analysis
  singleTokenLines: number;   // Lines with just one token
  emptyLines: number;
  maxIndentDepth: number;
  tabsUsed: boolean;
  spacesUsed: boolean;

  // Issues found
  issues: string[];
  warnings: string[];
}

function analyzeFile(filePath: string): AnalysisResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const result: AnalysisResult = {
    file: path.basename(filePath),
    size: Buffer.byteLength(content, 'utf-8'),
    lines: lines.length,
    avgCharsPerLine: content.length / lines.length,

    libSymbolDefs: 0,
    symbolInstances: 0,
    wires: 0,
    buses: 0,
    junctions: 0,
    noConnects: 0,
    labels: 0,
    globalLabels: 0,
    hierarchicalLabels: 0,
    text: 0,
    polylines: 0,
    rectangles: 0,
    circles: 0,
    arcs: 0,

    parenBalance: 0,
    topLevelElements: [],

    singleTokenLines: 0,
    emptyLines: 0,
    maxIndentDepth: 0,
    tabsUsed: false,
    spacesUsed: false,

    issues: [],
    warnings: [],
  };

  // Count elements
  result.libSymbolDefs = (content.match(/\(symbol "[^"]+"/g) || []).length;
  result.symbolInstances = (content.match(/\(symbol\s*\n?\s*\(lib_id/g) || []).length;
  result.wires = (content.match(/^\s*\(wire\b/gm) || []).length;
  result.buses = (content.match(/^\s*\(bus\b/gm) || []).length;
  result.junctions = (content.match(/^\s*\(junction\b/gm) || []).length;
  result.noConnects = (content.match(/^\s*\(no_connect\b/gm) || []).length;
  result.labels = (content.match(/^\s*\(label\b/gm) || []).length;
  result.globalLabels = (content.match(/^\s*\(global_label\b/gm) || []).length;
  result.hierarchicalLabels = (content.match(/^\s*\(hierarchical_label\b/gm) || []).length;
  result.text = (content.match(/^\s*\(text\b/gm) || []).length;
  result.polylines = (content.match(/^\s*\(polyline\b/gm) || []).length;
  result.rectangles = (content.match(/^\s*\(rectangle\b/gm) || []).length;
  result.circles = (content.match(/^\s*\(circle\b/gm) || []).length;
  result.arcs = (content.match(/^\s*\(arc\b/gm) || []).length;

  // Check parentheses balance
  let inString = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    if (char === '"' && prevChar !== '\\') {
      inString = !inString;
    } else if (!inString) {
      if (char === '(') result.parenBalance++;
      if (char === ')') result.parenBalance--;
    }
  }

  // Find top-level elements
  const topLevelPattern = /^\((\w+)/gm;
  let match;
  const seenTopLevel = new Set<string>();
  while ((match = topLevelPattern.exec(content)) !== null) {
    seenTopLevel.add(match[1]);
  }
  result.topLevelElements = Array.from(seenTopLevel);

  // Analyze line formatting
  for (const line of lines) {
    if (line.trim() === '') {
      result.emptyLines++;
      continue;
    }

    // Check indentation
    const leadingWhitespace = line.match(/^(\s*)/)?.[1] || '';
    if (leadingWhitespace.includes('\t')) result.tabsUsed = true;
    if (leadingWhitespace.includes('  ')) result.spacesUsed = true;

    const indentDepth = leadingWhitespace.replace(/\t/g, '    ').length;
    if (indentDepth > result.maxIndentDepth) {
      result.maxIndentDepth = indentDepth;
    }

    // Check for single-token lines (broken formatting indicator)
    const trimmed = line.trim();
    if (
      trimmed.match(/^[a-z_]+$/) ||           // Just a keyword
      trimmed.match(/^-?[0-9.]+$/) ||         // Just a number
      trimmed.match(/^\)$/) ||                 // Just closing paren
      trimmed.match(/^"[^"]*"$/)              // Just a string
    ) {
      result.singleTokenLines++;
    }
  }

  // Identify issues
  if (result.parenBalance !== 0) {
    result.issues.push(`CRITICAL: Unbalanced parentheses (${result.parenBalance > 0 ? '+' : ''}${result.parenBalance})`);
  }

  if (result.avgCharsPerLine < 20 && result.lines > 100) {
    result.issues.push(`Broken formatting: avg ${result.avgCharsPerLine.toFixed(1)} chars/line (should be 30-50+)`);
  }

  if (result.singleTokenLines > result.lines * 0.3) {
    result.issues.push(`${result.singleTokenLines} single-token lines (${((result.singleTokenLines / result.lines) * 100).toFixed(1)}%) - indicates broken nodeToString output`);
  }

  if (result.symbolInstances > 10 && result.wires === 0) {
    result.issues.push(`${result.symbolInstances} symbols but 0 wires - extraction likely failed`);
  }

  if (result.size > 512 * 1024) {
    result.warnings.push(`Large file size: ${(result.size / 1024).toFixed(1)} KB`);
  }

  if (result.lines > 20000) {
    result.warnings.push(`High line count: ${result.lines} lines`);
  }

  if (!result.topLevelElements.includes('lib_symbols') && result.symbolInstances > 0) {
    result.issues.push('Missing lib_symbols section but has symbol instances');
  }

  // Check for mixed indentation
  if (result.tabsUsed && result.spacesUsed) {
    result.warnings.push('Mixed tabs and spaces in indentation');
  }

  return result;
}

function printReport(result: AnalysisResult): void {
  console.log('═'.repeat(60));
  console.log('KiCad Clipboard Analysis Report');
  console.log('═'.repeat(60));

  console.log('\n📄 FILE INFO');
  console.log(`   File: ${result.file}`);
  console.log(`   Size: ${(result.size / 1024).toFixed(1)} KB (${result.size.toLocaleString()} bytes)`);
  console.log(`   Lines: ${result.lines.toLocaleString()}`);
  console.log(`   Avg chars/line: ${result.avgCharsPerLine.toFixed(1)}`);

  console.log('\n📊 ELEMENT COUNTS');
  console.log(`   lib_symbol definitions: ${result.libSymbolDefs}`);
  console.log(`   symbol instances: ${result.symbolInstances}`);
  console.log(`   wires: ${result.wires}`);
  console.log(`   buses: ${result.buses}`);
  console.log(`   junctions: ${result.junctions}`);
  console.log(`   no_connects: ${result.noConnects}`);
  console.log(`   labels: ${result.labels}`);
  console.log(`   global_labels: ${result.globalLabels}`);
  console.log(`   hierarchical_labels: ${result.hierarchicalLabels}`);
  console.log(`   text: ${result.text}`);
  console.log(`   polylines: ${result.polylines}`);
  console.log(`   rectangles: ${result.rectangles}`);
  console.log(`   circles: ${result.circles}`);
  console.log(`   arcs: ${result.arcs}`);

  console.log('\n🔧 STRUCTURE');
  console.log(`   Parentheses balance: ${result.parenBalance === 0 ? '✓ Balanced' : `✗ ${result.parenBalance}`}`);
  console.log(`   Top-level elements: ${result.topLevelElements.join(', ')}`);

  console.log('\n📝 FORMATTING');
  console.log(`   Single-token lines: ${result.singleTokenLines} (${((result.singleTokenLines / result.lines) * 100).toFixed(1)}%)`);
  console.log(`   Empty lines: ${result.emptyLines}`);
  console.log(`   Max indent depth: ${result.maxIndentDepth}`);
  console.log(`   Indentation: ${result.tabsUsed ? 'tabs' : ''}${result.tabsUsed && result.spacesUsed ? ' + ' : ''}${result.spacesUsed ? 'spaces' : ''}`);

  if (result.issues.length > 0) {
    console.log('\n❌ ISSUES FOUND');
    for (const issue of result.issues) {
      console.log(`   • ${issue}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS');
    for (const warning of result.warnings) {
      console.log(`   • ${warning}`);
    }
  }

  if (result.issues.length === 0 && result.warnings.length === 0) {
    console.log('\n✅ No issues detected');
  }

  console.log('\n' + '═'.repeat(60));

  // Summary verdict
  if (result.issues.length > 0) {
    console.log('VERDICT: This data has problems that may crash KiCad');
  } else if (result.warnings.length > 0) {
    console.log('VERDICT: This data may work but has some concerns');
  } else {
    console.log('VERDICT: This data appears valid');
  }
  console.log('═'.repeat(60));
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npx tsx scripts/analyze-clipboard.ts <file>');
  console.log('       npx tsx scripts/analyze-clipboard.ts test.txt');
  process.exit(1);
}

const filePath = args[0];
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const result = analyzeFile(filePath);
printReport(result);
