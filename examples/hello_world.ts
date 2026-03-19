/**
 * SCI Profiler — Hello World Example
 *
 * Demonstrates how to measure the Software Carbon Intensity (SCI) of any
 * async operation in a client-side application.
 *
 * Run this example with: npx tsx examples/hello_world.ts
 */
import {
    profileTool,
    configureSci,
    printResult,
    printSummary,
    toJsonLine,
    generateJsonLines,
    generateJsonReport,
    generateMarkdownReport,
} from '../src/sciProfiler';

// ── 1. Configure for your device (optional) ─────────────────────────────────
// Only supply the values you want to override — omitted fields keep defaults.
// You can also set SCI_PROFILER_* env vars in Node.js.
configureSci({
    devicePowerW: 15,               // Software-attributable device power (Watts)
    // carbonIntensity: 332,         // Grid carbon intensity (gCO₂eq/kWh) for your region
    // embodiedTotalG: 211_000,      // Embodied carbon excluding use-phase (grams CO₂e)
    // lifetimeHours: 11_680,        // Device lifetime in hours (e.g. 4 years × 365d × 8h)
    // lcaSource: 'Apple 14-inch MacBook Pro PER Oct 2021',
    machine: 'MacBook Air M2, 8GB, macOS 15',
});

// ── 2. Profile individual operations ─────────────────────────────────────────

// Simple: profile a CPU-bound operation (no I/O size tracking)
const sorting = await profileTool(
    'sort-array',
    async () => {
        const arr = Array.from({ length: 1_000_000 }, () => Math.random());
        arr.sort();
        return arr;
    },
);
printResult(sorting);

// With I/O tracking: measure input and output sizes
const jsonPayload = JSON.stringify({ users: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `User ${i}` })) });

const parsing = await profileTool(
    'json-parse',
    async () => JSON.parse(jsonPayload),
    jsonPayload.length,                        // inputBytes
    (data) => JSON.stringify(data).length,      // measureOutput
);
printResult(parsing);

// ── 3. Print summary table ───────────────────────────────────────────────────
const results = [sorting, parsing];
printSummary(results);

// ── 4. JSONL Report (PHP-compatible flat format) ─────────────────────────────
console.log('\n── JSONL Report (PHP-compatible) ──');
console.log(generateJsonLines(results));

// ── 5. Single JSON line ──────────────────────────────────────────────────────
console.log('\n── Single JSON line (pretty) ──');
console.log(JSON.stringify(toJsonLine(sorting), null, 2));

// ── 6. Legacy JSON Report ────────────────────────────────────────────────────
const jsonReport = generateJsonReport(results, { commit: 'hello-world' });
console.log('\n── Legacy JSON Report ──');
console.log(JSON.stringify(jsonReport, null, 2));

// ── 7. Markdown Report ──────────────────────────────────────────────────────
const mdReport = generateMarkdownReport(results, { commit: 'hello-world' });
console.log('\n── Markdown Report ──');
console.log(mdReport);
