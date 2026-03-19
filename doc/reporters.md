# Output Formats (Reporters)

SCI Profiler TypeScript supports four output formats for profiling results. Each serves a different use case.

## JSONL — Flat Format (Preferred)

The JSONL (JSON Lines) format produces one flat JSON object per profiled operation, using dot-notation keys. This is the **preferred format** for automation, CI/CD pipelines, and cross-platform analysis with [sci-profiler-php](https://github.com/fullo/sci-profiler-php).

### Single result

```ts
import { profileTool, toJsonLine } from './sciProfiler';

const result = await profileTool('my-operation', async () => doWork());
const line = toJsonLine(result);
console.log(JSON.stringify(line));
```

Output:

```json
{
  "profile_id": "a0fd3858-537c-4759-91ef-ad2b3a82f898",
  "timestamp": "2026-03-19T10:30:00.000Z",
  "tool": "my-operation",
  "time.wall_time_ms": 42,
  "time.wall_time_sec": 0.042,
  "memory.heap_delta_bytes": null,
  "io.input_bytes": 0,
  "io.output_bytes": 0,
  "sci.energy_kwh": 0.00000021,
  "sci.operational_carbon_gco2eq": 0.0000697,
  "sci.embodied_carbon_gco2eq": 0.0000211,
  "sci.sci_gco2eq": 0.0000908,
  "sci.sci_mgco2eq": 0.0908,
  "config.device_power_w": 18,
  "config.carbon_intensity": 332,
  "config.embodied_total_g": 211000,
  "config.lifetime_hours": 11680,
  "config.machine": "14-inch MacBook Pro M1 Pro, 16GB, macOS 15.3",
  "config.lca_source": "Apple 14-inch MacBook Pro PER Oct 2021"
}
```

### Multiple results (JSONL)

```ts
import { profileTool, generateJsonLines } from './sciProfiler';

const results = [
    await profileTool('op-a', async () => doA()),
    await profileTool('op-b', async () => doB()),
];
console.log(generateJsonLines(results));
```

Output (one JSON object per line):

```
{"profile_id":"...","tool":"op-a","time.wall_time_ms":42,"sci.sci_mgco2eq":0.092,...}
{"profile_id":"...","tool":"op-b","time.wall_time_ms":15,"sci.sci_mgco2eq":0.031,...}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `profile_id` | string | Unique UUID per measurement |
| `timestamp` | string | ISO 8601 timestamp |
| `tool` | string | Operation name |
| `time.wall_time_ms` | number | Wall time in milliseconds |
| `time.wall_time_sec` | number | Wall time in seconds (6 decimal places) |
| `memory.heap_delta_bytes` | number\|null | Heap memory change (Chrome only, null elsewhere) |
| `io.input_bytes` | number | Input size in bytes |
| `io.output_bytes` | number | Output size in bytes |
| `sci.energy_kwh` | number | Energy consumed (kWh) |
| `sci.operational_carbon_gco2eq` | number | Operational carbon E×I (gCO₂eq) |
| `sci.embodied_carbon_gco2eq` | number | Embodied carbon M (gCO₂eq) |
| `sci.sci_gco2eq` | number | Total SCI (gCO₂eq) |
| `sci.sci_mgco2eq` | number | Total SCI (mgCO₂eq) |
| `config.device_power_w` | number | Device power used for calculation |
| `config.carbon_intensity` | number | Grid carbon intensity used |
| `config.embodied_total_g` | number | Embodied carbon total used |
| `config.lifetime_hours` | number | Device lifetime used |
| `config.machine` | string | Machine description |
| `config.lca_source` | string | LCA data source |

### Analyzing with jq

```bash
# Extract SCI score from the last measurement
npx tsx your-script.ts 2>/dev/null | tail -1 | jq '.["sci.sci_mgco2eq"]'

# Show all tools and their SCI scores
npx tsx your-script.ts 2>/dev/null | grep '^{' | jq '{tool: .tool, sci: .["sci.sci_mgco2eq"]}'

# Sum total SCI across all operations
npx tsx your-script.ts 2>/dev/null | grep '^{' | jq -s '[.[]["sci.sci_mgco2eq"]] | add'
```

## Console Output

Color-formatted output for interactive use. Automatically detects Node.js (ANSI escape codes) vs browser (`%c` CSS styling).

### Single result

```ts
import { profileTool, printResult } from './sciProfiler';

const result = await profileTool('sort-array', async () => bigSort());
printResult(result);
```

Output:

```
[SCI] sort-array  42ms  69.874 mgCO₂eq  (E=69.662mg + M=0.211mg)  in=0 B out=0 B
```

### Summary table

```ts
import { printSummary } from './sciProfiler';

printSummary([result1, result2, result3]);
```

Output:

```
┌─────────┬──────────────┬───────────┬───────┬────────┬───────────┬───────────┬───────────────┐
│ (index) │ Tool         │ Time (ms) │ Input │ Output │ E (mgCO₂) │ M (mgCO₂) │ SCI (mgCO₂eq) │
├─────────┼──────────────┼───────────┼───────┼────────┼───────────┼───────────┼───────────────┤
│ 0       │ 'sort-array' │ 1274      │ '0 B' │ '0 B'  │ 1762.664  │ 6.394     │ 1769.059      │
│ 1       │ 'json-parse' │ 1         │ '28K' │ '28K'  │ 0.406     │ 0.001     │ 0.407         │
└─────────┴──────────────┴───────────┴───────┴────────┴───────────┴───────────┴───────────────┘
[SCI Summary] 2 tools  |  Total: 1769.466 mgCO₂eq  |  1275ms wall time
```

## Markdown Report

Table format suitable for embedding in README files, CI reports, or pull request comments.

```ts
import { generateMarkdownReport } from './sciProfiler';

const md = generateMarkdownReport(results, { commit: 'abc123', machine: 'CI Runner' });
console.log(md);
```

Output:

```markdown
# SCI Benchmark Report

**Date**: 2026-03-19T10:30:00.000Z
**Commit**: abc123
**Machine**: CI Runner
**Constants**: E power=18W, I=332 gCO₂eq/kWh, M embodied=211000g, lifetime=11680h
**LCA Source**: Apple 14-inch MacBook Pro PER Oct 2021

| Tool | Time (ms) | Input | Output | E (mgCO₂) | M (mgCO₂) | SCI (mgCO₂eq) |
|------|-----------|-------|--------|------------|------------|----------------|
| sort-array | 42 | 0 B | 0 B | 55.440 | 0.211 | 55.651 |

**Total**: 55.651 mgCO₂eq across 1 tools in 42ms
```

## Legacy JSON Report (Deprecated)

Nested JSON format from v1.0. Use `toJsonLine()` or `generateJsonLines()` instead.

```ts
import { generateJsonReport } from './sciProfiler';

const report = generateJsonReport(results, { commit: 'abc123' });
```

Output:

```json
{
  "commit": "abc123",
  "date": "2026-03-19T10:30:00.000Z",
  "machine": "14-inch MacBook Pro M1 Pro, 16GB, macOS 15.3",
  "lcaSource": "Apple 14-inch MacBook Pro PER Oct 2021",
  "constants": {
    "devicePowerW": 18,
    "carbonIntensity": 332,
    "embodiedG": 211000,
    "lifetimeH": 11680
  },
  "results": [
    {
      "service": "sort-array",
      "wallTimeMs": 42,
      "inputBytes": 0,
      "outputBytes": 0,
      "sciMgCO2eq": 55.651
    }
  ],
  "totalSciMg": 55.651
}
```

This format is **not compatible** with sci-profiler-php. Migrate to `generateJsonLines()` for cross-platform analysis.
