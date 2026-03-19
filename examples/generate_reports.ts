/**
 * SCI Profiler — Generate Report Files
 *
 * Profiles sample operations and writes all report formats to the reports/ directory:
 *   - reports/sci-profiler.jsonl    (PHP-compatible, append-only)
 *   - reports/benchmark.md          (Markdown table)
 *   - reports/profiler-overhead.jsonl (self-profiling data)
 *   - reports/profiler-overhead.md   (self-profiling markdown)
 *
 * Run: npx tsx examples/generate_reports.ts
 */
import {
    profileTool,
    configureSci,
    toJsonLine,
    generateJsonLines,
    generateMarkdownReport,
    printSummary,
} from '../src/sciProfiler';
import type { ProfileResult } from '../src/sciProfiler';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportsDir = resolve(__dirname, '..', 'reports');
mkdirSync(reportsDir, { recursive: true });

// ── Configuration ───────────────────────────────────────────────────────────

configureSci({
    devicePowerW: 15,
    machine: 'MacBook Air M2, 8GB, macOS 15',
});

// ── 1. Benchmark: sample operations ─────────────────────────────────────────

console.log('Profiling sample operations...\n');

const sorting = await profileTool(
    'sort-array',
    async () => {
        const arr = Array.from({ length: 1_000_000 }, () => Math.random());
        arr.sort();
        return arr;
    },
);

const jsonPayload = JSON.stringify({
    users: Array.from({ length: 1000 }, (_, i) => ({
        id: i, name: `User ${i}`, email: `user${i}@example.com`,
    })),
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

const regexWork = await profileTool(
    'regex-match',
    async () => {
        const text = 'hello world '.repeat(10_000);
        const matches = text.match(/\b\w{5}\b/g);
        return matches;
    },
    0,
    (m) => (m ? m.length * 5 : 0),
);

const benchResults = [sorting, parsing, hashing, regexWork];

printSummary(benchResults);

// ── 2. Profiler overhead (self-profiling) ───────────────────────────────────

console.log('\nProfiling the profiler...\n');

const sampleResult = await profileTool('sample', async () => 42);

const overheadProfileTool = await profileTool(
    'profileTool-overhead',
    async () => {
        for (let i = 0; i < 1_000; i++) {
            await profileTool(`noop-${i}`, async () => undefined);
        }
    },
);

const overheadToJsonLine = await profileTool(
    'toJsonLine-overhead',
    async () => {
        let last;
        for (let i = 0; i < 100_000; i++) {
            last = toJsonLine(sampleResult);
        }
        return last;
    },
);

const overheadJsonLines = await profileTool(
    'generateJsonLines-overhead',
    async () => {
        const batch: ProfileResult[] = [];
        for (let i = 0; i < 100; i++) batch.push(sampleResult);
        let last = '';
        for (let i = 0; i < 1_000; i++) {
            last = generateJsonLines(batch);
        }
        return last;
    },
);

const overheadMarkdown = await profileTool(
    'generateMarkdownReport-overhead',
    async () => {
        const batch: ProfileResult[] = [];
        for (let i = 0; i < 100; i++) batch.push(sampleResult);
        let last = '';
        for (let i = 0; i < 10_000; i++) {
            last = generateMarkdownReport(batch, { commit: 'bench' });
        }
        return last;
    },
);

const overheadResults = [overheadProfileTool, overheadToJsonLine, overheadJsonLines, overheadMarkdown];

printSummary(overheadResults);

// ── 3. Write report files ───────────────────────────────────────────────────

const commitHash = 'e083163';

// JSONL — benchmark
const benchJsonl = generateJsonLines(benchResults);
writeFileSync(resolve(reportsDir, 'sci-profiler.jsonl'), benchJsonl + '\n');
console.log(`\n✓ reports/sci-profiler.jsonl (${benchResults.length} entries)`);

// Markdown — benchmark
const benchMd = generateMarkdownReport(benchResults, { commit: commitHash });
writeFileSync(resolve(reportsDir, 'benchmark.md'), benchMd + '\n');
console.log(`✓ reports/benchmark.md`);

// JSONL — profiler overhead
const overheadJsonl = generateJsonLines(overheadResults);
writeFileSync(resolve(reportsDir, 'profiler-overhead.jsonl'), overheadJsonl + '\n');
console.log(`✓ reports/profiler-overhead.jsonl (${overheadResults.length} entries)`);

// Markdown — profiler overhead
const overheadMd = [
    '# SCI Profiler — Self-Profiling Report',
    '',
    `**Date**: ${new Date().toISOString()}`,
    `**Machine**: MacBook Air M2, 8GB, macOS 15`,
    `**Constants**: E power=15W, I=332 gCO₂eq/kWh, M embodied=211000g, lifetime=11680h`,
    '',
    '## Per-Call Cost (amortized)',
    '',
    '| Function | Iterations | Total (ms) | Per call (μs) | Per call SCI (μgCO₂eq) |',
    '|----------|-----------|------------|---------------|------------------------|',
    ...[
        { name: 'profileTool() no-op', calls: 1_000, result: overheadProfileTool },
        { name: 'toJsonLine()', calls: 100_000, result: overheadToJsonLine },
        { name: 'generateJsonLines(100)', calls: 1_000, result: overheadJsonLines },
        { name: 'generateMarkdownReport(100)', calls: 10_000, result: overheadMarkdown },
    ].map(p => {
        const perCallUs = +((p.result.wallTimeMs / p.calls) * 1000).toFixed(2);
        const perCallSci = +((p.result.sciMgCO2eq / p.calls) * 1000).toFixed(4);
        return `| ${p.name} | ${p.calls.toLocaleString()} | ${p.result.wallTimeMs} | ${perCallUs} | ${perCallSci} |`;
    }),
    '',
    `**Total profiler overhead**: ${overheadResults.reduce((s, r) => s + r.sciMgCO2eq, 0).toFixed(3)} mgCO₂eq across ${overheadResults.length} benchmarks`,
].join('\n');

writeFileSync(resolve(reportsDir, 'profiler-overhead.md'), overheadMd + '\n');
console.log(`✓ reports/profiler-overhead.md`);

console.log('\nAll reports written to reports/');
