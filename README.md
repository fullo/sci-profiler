# SCI Profiler

A framework-agnostic [Software Carbon Intensity (SCI)](https://sci-guide.greensoftware.foundation/) profiler for TypeScript/JavaScript applications. Measures the carbon footprint of any async operation using the Green Software Foundation formula.

**Zero dependencies. Single TypeScript file. Works in Node.js and any browser.**

> Cross-platform companion to [sci-profiler-php](https://github.com/fullo/sci-profiler-php) — same SCI formula, same default constants, compatible JSON output.

## Quick Start

```bash
npm install     # install dev dependencies (vitest, typescript)
npm run example # run the hello_world example
npm test        # run the test suite
npm run build   # compile to dist/
```

Copy `src/sciProfiler.ts` into your project (zero dependencies), then:

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

See [`examples/hello_world.ts`](examples/hello_world.ts) for a complete working example, or [`examples/profile_the_profiler.ts`](examples/profile_the_profiler.ts) for a meta-benchmark that profiles the profiler itself.

```ts
import {
    profileTool,
    configureSci,
    printResult,
    printSummary,
    toJsonLine,
    generateJsonLines,
} from './src/sciProfiler';

// 1. Configure for your device (optional — defaults to MacBook Pro M1 Pro)
configureSci({
    devicePowerW: 15,
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

// 3. Generate PHP-compatible JSONL report
console.log(generateJsonLines([result]));
// → {"profile_id":"...","tool":"sort-array","time.wall_time_ms":42,"sci.sci_mgco2eq":0.092,...}
```

Run examples with:

```bash
npx tsx examples/hello_world.ts
npx tsx examples/profile_the_profiler.ts
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

You can also configure via environment variables in Node.js (see [Configuration](doc/configuration.md)).

### `getSciConfig()`

Returns a copy of the current configuration.

### `resetSciConfig()`

Resets all parameters to their defaults.

### `toJsonLine(result)`

Converts a single `ProfileResult` to a flat JSON object using dot-notation keys, compatible with [sci-profiler-php](https://github.com/fullo/sci-profiler-php). Returns a typed `JsonLineReport`.

```ts
const line = toJsonLine(result);
// → { "profile_id": "uuid", "tool": "...", "time.wall_time_ms": 42, "sci.sci_mgco2eq": 0.092, ... }
```

### `generateJsonLines(results)`

Generates JSONL (JSON Lines) output from an array of results. Each result becomes one JSON line. Compatible with `jq`:

```bash
npx tsx examples/hello_world.ts 2>/dev/null | grep '^{' | jq '.["sci.sci_mgco2eq"]'
```

### `generateJsonReport(results, meta)` *(deprecated)*

Generates a legacy nested JSON report. Use `toJsonLine()` or `generateJsonLines()` instead for PHP-compatible output.

### `generateMarkdownReport(results, meta)`

Generates a markdown report table. `meta` requires `commit: string` and optionally `machine: string`.

### `printResult(result)`

Prints a single result to the console with color formatting. Works in both Node.js (ANSI) and browser (CSS).

### `printSummary(results)`

Prints a `console.table()` summary of multiple results with totals.

## Output Formats

The profiler supports multiple output formats. See [Reporters](doc/reporters.md) for full details.

| Format | Function | Description |
|--------|----------|-------------|
| **JSONL** (preferred) | `toJsonLine()` / `generateJsonLines()` | Flat dot-notation, PHP-compatible |
| **Console** | `printResult()` / `printSummary()` | Colored output, auto-detects Node.js/browser |
| **Markdown** | `generateMarkdownReport()` | Table format for CI/README |
| **JSON** (legacy) | `generateJsonReport()` | Nested format, deprecated |

## Configuration

Configuration can be set via:

1. **`configureSci()` API** — programmatic, works everywhere
2. **Environment variables** — `SCI_PROFILER_*`, Node.js only
3. **Built-in defaults** — Apple MacBook Pro M1 Pro LCA data

See [Configuration](doc/configuration.md) for full details.

## Default Parameters

| Parameter | Default | Source |
|-----------|---------|--------|
| `devicePowerW` | 18 | M1 Pro power measurements |
| `carbonIntensity` | 332 | GitHub Actions median (gCO₂eq/kWh) |
| `embodiedTotalG` | 211,000 | Apple LCA: 271kg total − 59.6kg use-phase |
| `lifetimeHours` | 11,680 | 4 years × 365d × 8h/d |
| `lcaSource` | Apple 14-inch MacBook Pro PER Oct 2021 | |
| `machine` | 14-inch MacBook Pro M1 Pro, 16GB, macOS 15.3 | |

Defaults are sourced from the [Apple 14-inch MacBook Pro Product Environmental Report (Oct 2021)](https://www.apple.com/environment/pdf/products/notebooks/14-inch_MacBook_Pro_PER_Oct2021.pdf). See [METHODOLOGY.md](METHODOLOGY.md) for the full derivation.

## Cross-Platform Compatibility

The JSONL output format is designed to be compatible with [sci-profiler-php](https://github.com/fullo/sci-profiler-php). Both profilers share the same:

- SCI formula: `SCI = ((E × I) + M) / R`
- Default constants (18W, 332 gCO₂eq/kWh, 211,000g embodied, 11,680h lifetime)
- JSON field names (`sci.sci_mgco2eq`, `time.wall_time_ms`, etc.)

See [Cross-Platform Compatibility](doc/cross-platform.md) for details on field mapping and analysis workflows.

## Integration

### npm package

```bash
npm install sci-profiler
```

```ts
import { profileTool } from 'sci-profiler';
```

### As a git submodule

```bash
git submodule add https://github.com/fullo/sci-profiler.git lib/sci-profiler
```

```ts
import { profileTool } from './lib/sci-profiler/src/sciProfiler';
```

### Direct copy

Copy `src/sciProfiler.ts` into your project. It has zero dependencies and zero imports.

## Documentation

| Document | Description |
|----------|-------------|
| [METHODOLOGY.md](METHODOLOGY.md) | SCI formula, energy model, LCA data sources, limitations |
| [doc/configuration.md](doc/configuration.md) | All configuration methods (API, env vars, defaults) |
| [doc/reporters.md](doc/reporters.md) | Output formats (JSONL, console, markdown, JSON) |
| [doc/cross-platform.md](doc/cross-platform.md) | PHP compatibility, field mapping, analysis workflows |

### Framework Integration Guides

| Guide | Description |
|-------|-------------|
| [doc/example-react.md](doc/example-react.md) | React / Next.js — hooks, SSR, SSG, data fetching |
| [doc/example-angular.md](doc/example-angular.md) | Angular — services, interceptors, Universal SSR, RxJS |
| [doc/example-vite.md](doc/example-vite.md) | Vite / build tools — plugins, bundling, HMR, CI pipelines |
| [doc/example-node.md](doc/example-node.md) | Node.js / Express / Fastify — middleware, jobs, CLI scripts |

## License

[MIT](LICENSE)
