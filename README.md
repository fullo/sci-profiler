# SCI Profiler

A framework-agnostic [Software Carbon Intensity (SCI)](https://sci-guide.greensoftware.foundation/) profiler for client-side applications. Measures the carbon footprint of any async operation using the Green Software Foundation formula.

**Zero dependencies. Single TypeScript file. Works in any browser or runtime.**

## Quick Start

Copy `src/sciProfiler.ts` into your project, then:

```ts
import { profileTool, printResult } from './sciProfiler';

const result = await profileTool(
    'my-operation',
    async () => {
        // any async work you want to measure
        return await processData(input);
    },
    input.byteLength,                    // inputBytes (optional)
    (output) => output.byteLength,       // measureOutput (optional)
);

printResult(result);
// → [SCI] my-operation  42ms  69.874 mgCO₂eq  (E=69.662mg + M=0.211mg)
```

## Example

See [`examples/hello_world.ts`](examples/hello_world.ts) for a complete working example:

```ts
import {
    profileTool,
    configureSci,
    printResult,
    printSummary,
    generateJsonReport,
} from './src/sciProfiler';

// 1. Configure for your device (optional — defaults to MacBook Pro M1 Pro)
configureSci({
    devicePowerW: 15,               // Software-attributable device power (Watts)
    // carbonIntensity: 332,         // Grid carbon intensity (gCO₂eq/kWh) for your region
    // embodiedTotalG: 211_000,      // Embodied carbon excluding use-phase (grams CO₂e)
    // lifetimeHours: 11_680,        // Device lifetime in hours (e.g. 4 years × 365d × 8h)
    // lcaSource: 'Apple 14-inch MacBook Pro PER Oct 2021',
    machine: 'MacBook Air M2, 8GB, macOS 15',
});

// 2. Profile operations
const result = await profileTool(
    'sort-array',
    async () => {
        const arr = Array.from({ length: 1_000_000 }, () => Math.random());
        arr.sort();
        return arr;
    },
);

printResult(result);

// 3. Generate reports
const report = generateJsonReport([result], { commit: 'abc123' });
```

Run the example with:

```bash
npx tsx examples/hello_world.ts
```

## API Reference

### `profileTool<T>(name, operation, inputBytes?, measureOutput?)`

Profile any async operation, measuring wall time and computing SCI.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `string` | — | Human-readable operation name |
| `operation` | `() => Promise<T>` | — | The async function to measure |
| `inputBytes` | `number` | `0` | Known input size in bytes |
| `measureOutput` | `(result: T) => number` | — | Callback to extract output size from the result |

Returns a `ProfileResult`:

```ts
interface ProfileResult {
    tool: string;
    wallTimeMs: number;
    inputSizeBytes: number;
    outputSizeBytes: number;
    heapDeltaBytes: number | null;  // Chrome only
    energyKwh: number;
    carbonOperationalMg: number;    // E × I component
    carbonEmbodiedMg: number;       // M component
    sciMgCO2eq: number;             // Total SCI score
}
```

### `configureSci(overrides)`

Configure SCI parameters for your device. Only supply the values you want to override.

```ts
configureSci({
    devicePowerW: 25,
    carbonIntensity: 450,
    embodiedTotalG: 300_000,
    lifetimeHours: 14_600,
    lcaSource: 'Dell XPS 15 Product Carbon Footprint 2024',
    machine: 'Dell XPS 15 9530, i7-13700H, 32GB, Ubuntu 24.04',
});
```

### `getSciConfig()`

Returns a copy of the current configuration.

### `resetSciConfig()`

Resets all parameters to their defaults.

### `printResult(result)`

Prints a single result to the console with color formatting.

### `printSummary(results)`

Prints a `console.table()` summary of multiple results.

### `generateJsonReport(results, meta)`

Generates a JSON report object. `meta` requires `commit: string` and optionally `machine: string`.

### `generateMarkdownReport(results, meta)`

Generates a markdown report table. Same `meta` as above.

## Default Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `devicePowerW` | 18 | Software-attributable device power (Watts) |
| `carbonIntensity` | 332 | Grid carbon intensity (gCO₂eq/kWh) |
| `embodiedTotalG` | 211,000 | Embodied carbon excluding use-phase (grams CO₂e) |
| `lifetimeHours` | 11,680 | Device lifetime (hours) |
| `lcaSource` | Apple 14-inch MacBook Pro PER Oct 2021 | LCA data source description |
| `machine` | 14-inch MacBook Pro M1 Pro, 16GB, macOS 15.3 | Machine description for reports |

Defaults are sourced from the [Apple 14-inch MacBook Pro Product Environmental Report (Oct 2021)](https://www.apple.com/environment/pdf/products/notebooks/14-inch_MacBook_Pro_PER_Oct2021.pdf). See [METHODOLOGY.md](METHODOLOGY.md) for the full derivation.

## Integration

### As a git submodule

```bash
git submodule add https://github.com/fullo/sci-profiler.git lib/sci-profiler
```

Then import in your project:

```ts
import { profileTool } from './lib/sci-profiler/src/sciProfiler';
```

### Direct copy

Copy `src/sciProfiler.ts` into your project. It has zero dependencies and zero imports.

## Methodology

See [METHODOLOGY.md](METHODOLOGY.md) for the full scientific methodology, including:

- The SCI formula and how each variable is computed
- Why wall time is used and how it relates to CPU cycles and energy
- The constant power model and its assumptions
- How embodied carbon is amortized from device LCA data
- Known limitations and how to improve accuracy

## License

[MIT](LICENSE)
