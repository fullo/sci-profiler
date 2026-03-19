/**
 * SCI Profiler — Report Formats Example
 *
 * Demonstrates all available output formats side by side:
 *   1. Console (printResult / printSummary)
 *   2. JSONL flat format (toJsonLine / generateJsonLines) — PHP-compatible
 *   3. Markdown report (generateMarkdownReport)
 *   4. Legacy JSON report (generateJsonReport) — deprecated
 *
 * Run: npx tsx examples/report_formats.ts
 */
import {
    profileTool,
    configureSci,
    printResult,
    printSummary,
    toJsonLine,
    generateJsonLines,
    generateMarkdownReport,
    generateJsonReport,
} from '../src/sciProfiler';

configureSci({
    devicePowerW: 15,
    machine: 'MacBook Air M2, 8GB, macOS 15',
});

// ── Profile some sample operations ──────────────────────────────────────────

const sorting = await profileTool(
    'sort-array',
    async () => {
        const arr = Array.from({ length: 500_000 }, () => Math.random());
        arr.sort();
        return arr;
    },
);

const jsonPayload = JSON.stringify({
    users: Array.from({ length: 500 }, (_, i) => ({ id: i, name: `User ${i}`, email: `user${i}@example.com` })),
});

const parsing = await profileTool(
    'json-parse',
    async () => JSON.parse(jsonPayload),
    jsonPayload.length,
    (data) => JSON.stringify(data).length,
);

const hashing = await profileTool(
    'hash-compute',
    async () => {
        let hash = 0;
        const str = 'x'.repeat(100_000);
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return hash;
    },
);

const results = [sorting, parsing, hashing];

// ═══════════════════════════════════════════════════════════════════════════
//  FORMAT 1: Console Output (printResult + printSummary)
// ═══════════════════════════════════════════════════════════════════════════

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  FORMAT 1: Console Output                                ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

for (const r of results) printResult(r);
console.log('');
printSummary(results);

// ═══════════════════════════════════════════════════════════════════════════
//  FORMAT 2: JSONL — Single Line (toJsonLine)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  FORMAT 2: JSONL — Single Line (pretty)                  ║');
console.log('║  Function: toJsonLine(result)                            ║');
console.log('║  Use case: per-operation logging, PHP-compatible         ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(JSON.stringify(toJsonLine(sorting), null, 2));

// ═══════════════════════════════════════════════════════════════════════════
//  FORMAT 3: JSONL — Multiple Lines (generateJsonLines)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  FORMAT 3: JSONL — Multiple Lines                        ║');
console.log('║  Function: generateJsonLines(results)                    ║');
console.log('║  Use case: append to .jsonl file, pipe to jq             ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(generateJsonLines(results));

// ═══════════════════════════════════════════════════════════════════════════
//  FORMAT 4: Markdown Report (generateMarkdownReport)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  FORMAT 4: Markdown Report                               ║');
console.log('║  Function: generateMarkdownReport(results, meta)         ║');
console.log('║  Use case: embed in README, PR comments, CI reports      ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(generateMarkdownReport(results, { commit: 'abc123' }));

// ═══════════════════════════════════════════════════════════════════════════
//  FORMAT 5: Legacy JSON Report (generateJsonReport) — deprecated
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  FORMAT 5: Legacy JSON Report (DEPRECATED)               ║');
console.log('║  Function: generateJsonReport(results, meta)             ║');
console.log('║  Prefer: toJsonLine() or generateJsonLines()             ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log(JSON.stringify(generateJsonReport(results, { commit: 'abc123' }), null, 2));

// ═══════════════════════════════════════════════════════════════════════════
//  Parsing tips
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  JSONL Analysis Tips (pipe this script\'s output to jq)   ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('# Extract SCI scores:');
console.log('#   npx tsx examples/report_formats.ts 2>/dev/null | grep \'^\\\' | jq \'.[\"sci.sci_mgco2eq"]\'');
console.log('#');
console.log('# Show tool + SCI as TSV:');
console.log('#   ... | jq -r \'[.tool, .[\"sci.sci_mgco2eq\"]] | @tsv\'');
console.log('#');
console.log('# Sum total SCI:');
console.log('#   ... | jq -s \'[.[][\"sci.sci_mgco2eq\"]] | add\'');
console.log('#');
console.log('# Append to PHP-compatible log:');
console.log('#   ... | grep \'^\\\' >> /tmp/sci-profiler/sci-profiler.jsonl');
