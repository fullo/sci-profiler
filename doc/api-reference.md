# API Reference

All exports are from a single file: `src/sciProfiler.ts`.

## Profiling

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

Example:

```ts
import { profileTool } from './sciProfiler';

const result = await profileTool(
    'sort-array',
    async () => {
        const arr = Array.from({ length: 1_000_000 }, () => Math.random());
        arr.sort();
        return arr;
    },
);
```

With I/O tracking:

```ts
const result = await profileTool(
    'json-parse',
    async () => JSON.parse(payload),
    payload.length,                        // inputBytes
    (data) => JSON.stringify(data).length,  // measureOutput
);
```

## Configuration

### `configureSci(overrides: Partial<SciConfig>): SciConfig`

Override SCI parameters for your device. Only supply the values you want to change — omitted fields keep their current value.

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

See [configuration.md](configuration.md) for environment variable support.

### `getSciConfig(): SciConfig`

Returns a copy of the current configuration (safe to modify without side effects).

### `resetSciConfig(): SciConfig`

Resets all parameters to built-in defaults and returns the reset config.

### `SciConfig` interface

```ts
interface SciConfig {
    devicePowerW: number;      // Software-attributable device power (Watts)
    carbonIntensity: number;   // Grid carbon intensity (gCO₂eq/kWh)
    embodiedTotalG: number;    // Embodied carbon excluding use-phase (grams CO₂e)
    lifetimeHours: number;     // Device lifetime in hours
    lcaSource: string;         // LCA data source description
    machine: string;           // Machine description for reports
}
```

## Reporters

### `toJsonLine(result: ProfileResult): JsonLineReport`

Converts a single `ProfileResult` to a flat JSON object using dot-notation keys, compatible with [sci-profiler-php](https://github.com/fullo/sci-profiler-php).

```ts
const line = toJsonLine(result);
console.log(JSON.stringify(line));
// → {"profile_id":"uuid","tool":"...","time.wall_time_ms":42,"sci.sci_mgco2eq":0.092,...}
```

See [reporters.md](reporters.md) for the full field reference.

### `generateJsonLines(results: ProfileResult[]): string`

Generates JSONL (JSON Lines) output from an array of results. Each result becomes one JSON line.

```ts
const jsonl = generateJsonLines([result1, result2]);
// One JSON object per line, compatible with jq
```

### `printResult(result: ProfileResult): void`

Prints a single result to the console with color formatting. Auto-detects Node.js (ANSI) vs browser (CSS).

```
[SCI] sort-array  42ms  69.874 mgCO₂eq  (E=69.662mg + M=0.211mg)  in=0 B out=0 B
```

### `printSummary(results: ProfileResult[]): void`

Prints a `console.table()` summary of multiple results with totals.

### `generateMarkdownReport(results, meta): string`

Generates a markdown report table.

| Parameter | Type | Description |
|-----------|------|-------------|
| `results` | `ProfileResult[]` | Array of profiling results |
| `meta.commit` | `string` | Commit hash or identifier |
| `meta.machine` | `string?` | Machine description (defaults to config) |

### `generateJsonReport(results, meta): object` *(deprecated)*

Legacy nested JSON format. Use `toJsonLine()` or `generateJsonLines()` instead for PHP-compatible output.

## Types

### `JsonLineReport`

Typed interface for the flat JSONL output format. All fields use dot-notation keys for PHP compatibility.

```ts
interface JsonLineReport {
    profile_id: string;
    timestamp: string;
    tool: string;
    'time.wall_time_ms': number;
    'time.wall_time_sec': number;
    'memory.heap_delta_bytes': number | null;
    'io.input_bytes': number;
    'io.output_bytes': number;
    'sci.energy_kwh': number;
    'sci.operational_carbon_gco2eq': number;
    'sci.embodied_carbon_gco2eq': number;
    'sci.sci_gco2eq': number;
    'sci.sci_mgco2eq': number;
    'config.device_power_w': number;
    'config.carbon_intensity': number;
    'config.embodied_total_g': number;
    'config.lifetime_hours': number;
    'config.machine': string;
    'config.lca_source': string;
}
```

## Constants

All exported and overridable via `configureSci()`:

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_DEVICE_POWER_W` | `18` | M1 Pro: CPU + mem ctrl + SSD/system |
| `DEFAULT_CARBON_INTENSITY` | `332` | GitHub Actions median (gCO₂eq/kWh) |
| `DEFAULT_EMBODIED_TOTAL_G` | `211_000` | Apple LCA: 271kg − 59.6kg use-phase |
| `DEFAULT_LIFETIME_HOURS` | `11_680` | 4 years × 365d × 8h/d |
| `DEFAULT_LCA_SOURCE` | `'Apple 14-inch MacBook Pro PER Oct 2021'` | |
| `DEFAULT_MACHINE` | `'14-inch MacBook Pro M1 Pro, 16GB, macOS 15.3'` | |

## Integration

### Git submodule

```bash
git submodule add https://github.com/fullo/sci-profiler.git lib/sci-profiler
```

```ts
import { profileTool } from './lib/sci-profiler/src/sciProfiler';
```

### Direct copy

Copy `src/sciProfiler.ts` into your project. Zero dependencies, zero imports.
