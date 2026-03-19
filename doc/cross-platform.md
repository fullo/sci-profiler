# Cross-Platform Compatibility with sci-profiler-php

SCI Profiler TypeScript and [sci-profiler-php](https://github.com/fullo/sci-profiler-php) are companion tools designed to produce compatible output. This allows teams to measure and compare carbon footprint across their full stack — PHP backend and TypeScript/JavaScript frontend — using the same format and tooling.

## What's Shared

| Aspect | TypeScript | PHP |
|--------|-----------|-----|
| **SCI Formula** | `SCI = ((E × I) + M) / R` | Same |
| **Default device power** | 18W | 18W |
| **Default carbon intensity** | 332 gCO₂eq/kWh | 332 gCO₂eq/kWh |
| **Default embodied carbon** | 211,000g | 211,000g |
| **Default lifetime** | 11,680 hours | 11,680 hours |
| **Output format** | JSONL (flat, dot-notation) | JSONL (flat, dot-notation) |
| **Energy model** | Constant power × wall time | Constant power × wall time |

## JSON Field Mapping

Both profilers use the same dot-notation field names in their JSONL output:

### Timing fields

| Field | TS | PHP |
|-------|:--:|:---:|
| `time.wall_time_ms` | yes | yes |
| `time.wall_time_sec` | yes | yes |
| `time.cpu_user_time_sec` | — | yes |
| `time.cpu_system_time_sec` | — | yes |
| `time.cpu_total_time_sec` | — | yes |

> **Note**: CPU time fields are PHP-only because browsers and Node.js don't expose `getrusage()` data.

### SCI fields

| Field | TS | PHP |
|-------|:--:|:---:|
| `sci.energy_kwh` | yes | yes |
| `sci.operational_carbon_gco2eq` | yes | yes |
| `sci.embodied_carbon_gco2eq` | yes | yes |
| `sci.sci_gco2eq` | yes | yes |
| `sci.sci_mgco2eq` | yes | yes |

### Memory fields

| Field | TS | PHP |
|-------|:--:|:---:|
| `memory.heap_delta_bytes` | yes (Chrome only) | — |
| `memory.memory_peak_bytes` | — | yes |
| `memory.memory_delta_bytes` | — | yes |

### I/O fields

| Field | TS | PHP |
|-------|:--:|:---:|
| `io.input_bytes` | yes | — |
| `io.output_bytes` | yes | — |

### Request fields (PHP only)

| Field | TS | PHP |
|-------|:--:|:---:|
| `request.method` | — | yes |
| `request.uri` | — | yes |
| `request.response_code` | — | yes |

### Config fields

| Field | TS | PHP |
|-------|:--:|:---:|
| `config.device_power_w` | yes | — |
| `config.carbon_intensity` | yes | — |
| `config.embodied_total_g` | yes | — |
| `config.lifetime_hours` | yes | — |
| `config.machine` | yes | — |
| `config.lca_source` | yes | — |

### Metadata fields

| Field | TS | PHP |
|-------|:--:|:---:|
| `profile_id` | yes | yes |
| `timestamp` | yes | yes |
| `tool` | yes | — |

## Unified Analysis

Since both profilers produce JSONL with compatible `sci.*` fields, you can merge and analyze output from both using standard tools.

### Merge and compare

```bash
# Combine PHP and TS profiling results
cat /tmp/sci-profiler/sci-profiler.jsonl ts-results.jsonl > combined.jsonl

# Compare SCI scores across stack
cat combined.jsonl | jq -r '[.tool // .["request.uri"], .["sci.sci_mgco2eq"]] | @tsv'

# Total carbon for the full request lifecycle
cat combined.jsonl | jq -s '[.[]["sci.sci_mgco2eq"]] | add'
```

### Track over time

```bash
# Append TS results to the same JSONL file PHP uses
npx tsx your-benchmark.ts 2>/dev/null | grep '^{' >> /tmp/sci-profiler/sci-profiler.jsonl

# Filter by timestamp range
cat combined.jsonl | jq -r 'select(.timestamp > "2026-03-01") | [.timestamp, .["sci.sci_mgco2eq"]] | @tsv'
```

### CI integration

```bash
# In your CI pipeline, capture SCI scores from both
# PHP (runs automatically via auto_prepend_file)
php artisan your:command

# TypeScript
npx tsx benchmark.ts 2>/dev/null | grep '^{' > ts-results.jsonl

# Assert total SCI stays under budget
TOTAL=$(cat /tmp/sci-profiler/sci-profiler.jsonl ts-results.jsonl | jq -s '[.[]["sci.sci_mgco2eq"]] | add')
echo "Total SCI: ${TOTAL} mgCO₂eq"
```

## Key Differences

| Aspect | TypeScript | PHP |
|--------|-----------|-----|
| **Measurement scope** | Any async operation (`profileTool()`) | Full HTTP request / CLI execution |
| **Injection method** | Manual `import` | Non-invasive `auto_prepend_file` |
| **CPU time** | Not available (browser/Node.js limitation) | `getrusage()` user + system time |
| **Request context** | Not applicable | HTTP method, URI, response code |
| **Memory** | `performance.memory` (Chrome only) | `memory_get_peak_usage()` |
| **Output destination** | stdout / programmatic | File (JSONL, log, HTML dashboard) |
| **Config method** | API + env vars | PHP file + env vars + phar defaults |

## When to Use Which

- **sci-profiler-php**: measure your backend — HTTP request handling, database queries, API calls, CLI jobs
- **sci-profiler-ts**: measure your frontend — rendering, data processing, Web Worker operations, build tools, Node.js scripts
- **Both together**: full-stack carbon footprint with unified JSONL analysis
