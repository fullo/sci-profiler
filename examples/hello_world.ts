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
    generateJsonReport,
    generateMarkdownReport,
} from '../src/sciProfiler';

// ── 1. Configure for your device (optional) ─────────────────────────────────
// Only supply the values you want to override — omitted fields keep defaults.
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

// Canvas rendering example (browser only)
// const rendering = await profileTool(
//     'canvas-render',
//     async () => {
//         const canvas = document.createElement('canvas');
//         canvas.width = 1920; canvas.height = 1080;
//         const ctx = canvas.getContext('2d')!;
//         for (let i = 0; i < 10000; i++) {
//             ctx.fillStyle = `hsl(${i % 360}, 70%, 50%)`;
//             ctx.fillRect(Math.random() * 1920, Math.random() * 1080, 10, 10);
//         }
//         return canvas.toDataURL();
//     },
//     0,
//     (dataUrl) => dataUrl.length,
// );
// printResult(rendering);

// ── 3. Print summary table ───────────────────────────────────────────────────
const results = [sorting, parsing];
printSummary(results);

// ── 4. Generate reports ──────────────────────────────────────────────────────
const jsonReport = generateJsonReport(results, { commit: 'hello-world' });
console.log('\n── JSON Report ──');
console.log(JSON.stringify(jsonReport, null, 2));

const mdReport = generateMarkdownReport(results, { commit: 'hello-world' });
console.log('\n── Markdown Report ──');
console.log(mdReport);
