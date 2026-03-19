/**
 * Profile the profiler — measuring the SCI carbon footprint of sci-profiler's
 * own operations. A meta-benchmark that answers: "how much carbon does it cost
 * to measure carbon?"
 *
 * Run: npx tsx examples/profile_the_profiler.ts
 */
import {
    profileTool,
    configureSci,
    resetSciConfig,
    getSciConfig,
    printResult,
    printSummary,
    toJsonLine,
    generateJsonLines,
    generateJsonReport,
    generateMarkdownReport,
} from '../src/sciProfiler';
import type { ProfileResult } from '../src/sciProfiler';

console.log('═══════════════════════════════════════════════════════════');
console.log('  Profile the Profiler — SCI cost of measuring carbon');
console.log('═══════════════════════════════════════════════════════════\n');

// ── 1. Profile: configureSci() ──────────────────────────────────────────────
const configureResult = await profileTool(
    'configureSci',
    async () => {
        for (let i = 0; i < 10_000; i++) {
            configureSci({ devicePowerW: 15 + (i % 10), machine: `Machine-${i}` });
        }
    },
);
resetSciConfig();

// ── 2. Profile: getSciConfig() ──────────────────────────────────────────────
const getConfigResult = await profileTool(
    'getSciConfig',
    async () => {
        let last;
        for (let i = 0; i < 100_000; i++) {
            last = getSciConfig();
        }
        return last;
    },
);

// ── 3. Profile: profileTool() itself (single call overhead) ─────────────────
const profileToolResult = await profileTool(
    'profileTool-overhead',
    async () => {
        // Profile 1000 no-op calls to measure pure overhead
        for (let i = 0; i < 1_000; i++) {
            await profileTool(`noop-${i}`, async () => undefined);
        }
    },
);

// ── 4. Profile: profileTool() with I/O measurement ─────────────────────────
const payload = JSON.stringify({ data: Array.from({ length: 500 }, (_, i) => ({ id: i, value: Math.random() })) });
const profileWithIOResult = await profileTool(
    'profileTool-with-io',
    async () => {
        for (let i = 0; i < 1_000; i++) {
            await profileTool(
                `io-${i}`,
                async () => JSON.parse(payload),
                payload.length,
                (d) => JSON.stringify(d).length,
            );
        }
    },
);

// ── 5. Profile: toJsonLine() ────────────────────────────────────────────────
// First create a sample result to convert
const sampleResult = await profileTool('sample', async () => 42);
const toJsonLineResult = await profileTool(
    'toJsonLine',
    async () => {
        let last;
        for (let i = 0; i < 100_000; i++) {
            last = toJsonLine(sampleResult);
        }
        return last;
    },
    0,
    (line) => JSON.stringify(line).length,
);

// ── 6. Profile: generateJsonLines() ─────────────────────────────────────────
// Build a batch of 100 sample results
const sampleResults: ProfileResult[] = [];
for (let i = 0; i < 100; i++) {
    sampleResults.push(await profileTool(`batch-${i}`, async () => i));
}

const jsonLinesResult = await profileTool(
    'generateJsonLines',
    async () => {
        let last = '';
        for (let i = 0; i < 1_000; i++) {
            last = generateJsonLines(sampleResults);
        }
        return last;
    },
    0,
    (output) => output.length,
);

// ── 7. Profile: generateJsonReport() (legacy) ──────────────────────────────
const jsonReportResult = await profileTool(
    'generateJsonReport',
    async () => {
        let last;
        for (let i = 0; i < 10_000; i++) {
            last = generateJsonReport(sampleResults, { commit: 'bench' });
        }
        return last;
    },
    0,
    (report) => JSON.stringify(report).length,
);

// ── 8. Profile: generateMarkdownReport() ────────────────────────────────────
const mdReportResult = await profileTool(
    'generateMarkdownReport',
    async () => {
        let last = '';
        for (let i = 0; i < 10_000; i++) {
            last = generateMarkdownReport(sampleResults, { commit: 'bench' });
        }
        return last;
    },
    0,
    (md) => md.length,
);

// ── 9. Profile: resetSciConfig() ────────────────────────────────────────────
const resetResult = await profileTool(
    'resetSciConfig',
    async () => {
        for (let i = 0; i < 100_000; i++) {
            resetSciConfig();
        }
    },
);

// ── Results ─────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Results');
console.log('═══════════════════════════════════════════════════════════\n');

const allResults = [
    configureResult,
    getConfigResult,
    profileToolResult,
    profileWithIOResult,
    toJsonLineResult,
    jsonLinesResult,
    jsonReportResult,
    mdReportResult,
    resetResult,
];

for (const r of allResults) printResult(r);
console.log('');
printSummary(allResults);

// ── Per-call cost ───────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Per-call cost (amortized)');
console.log('═══════════════════════════════════════════════════════════\n');

const perCall = [
    { name: 'configureSci()',         calls: 10_000,  result: configureResult },
    { name: 'getSciConfig()',         calls: 100_000, result: getConfigResult },
    { name: 'profileTool() no-op',    calls: 1_000,   result: profileToolResult },
    { name: 'profileTool() with I/O', calls: 1_000,   result: profileWithIOResult },
    { name: 'toJsonLine()',           calls: 100_000, result: toJsonLineResult },
    { name: 'generateJsonLines(100)', calls: 1_000,   result: jsonLinesResult },
    { name: 'generateJsonReport(100)',calls: 10_000,  result: jsonReportResult },
    { name: 'generateMarkdownReport(100)', calls: 10_000, result: mdReportResult },
    { name: 'resetSciConfig()',       calls: 100_000, result: resetResult },
];

console.table(perCall.map(p => ({
    'Function': p.name,
    'Iterations': p.calls,
    'Total (ms)': p.result.wallTimeMs,
    'Per call (μs)': +((p.result.wallTimeMs / p.calls) * 1000).toFixed(2),
    'Per call SCI (μgCO₂eq)': +((p.result.sciMgCO2eq / p.calls) * 1000).toFixed(4),
})));

// ── JSONL output ────────────────────────────────────────────────────────────
console.log('\n── JSONL (pipe to jq) ──');
console.log(generateJsonLines(allResults));
