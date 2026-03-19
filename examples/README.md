# Examples

Runnable examples demonstrating SCI Profiler features. All examples require [tsx](https://github.com/esbuild-kit/tsx) (installed via `npx`).

## Quick Start

```bash
npm run example                              # Run hello_world.ts
npx tsx examples/report_formats.ts           # Show all output formats
npx tsx examples/profile_the_profiler.ts     # Self-benchmark
npx tsx examples/generate_reports.ts         # Write reports to reports/
```

## Examples

### [`hello_world.ts`](hello_world.ts)

**Getting started** — the minimum viable profiling session:

1. Configure the profiler for your device
2. Profile a CPU-bound operation (array sort)
3. Profile an I/O-tracked operation (JSON parse)
4. Print summary table
5. Generate JSONL and markdown reports

```bash
npm run example
```

### [`report_formats.ts`](report_formats.ts)

**All output formats side by side** — shows every reporter:

1. Console output (`printResult` / `printSummary`)
2. JSONL single line (`toJsonLine`) — pretty-printed
3. JSONL multiple lines (`generateJsonLines`)
4. Markdown report (`generateMarkdownReport`)
5. Legacy JSON report (`generateJsonReport`) — deprecated

```bash
npx tsx examples/report_formats.ts
```

### [`profile_the_profiler.ts`](profile_the_profiler.ts)

**Meta-benchmark** — measures the carbon cost of the profiler's own operations:

- Per-call overhead of `profileTool()`, `configureSci()`, `toJsonLine()`, etc.
- Amortized cost table in μs and μgCO₂eq
- Validates that profiler overhead is negligible vs real workloads

```bash
npx tsx examples/profile_the_profiler.ts
```

### [`generate_reports.ts`](generate_reports.ts)

**Write report files** — profiles sample operations and the profiler itself, then writes results to `reports/`:

- `reports/sci-profiler.jsonl` — benchmark results in PHP-compatible JSONL
- `reports/benchmark.md` — benchmark results as markdown table
- `reports/profiler-overhead.jsonl` — self-profiling data
- `reports/profiler-overhead.md` — self-profiling summary with per-call cost table

```bash
npx tsx examples/generate_reports.ts
```

## Output

All examples print to stdout. To capture JSONL for analysis:

```bash
npx tsx examples/hello_world.ts 2>/dev/null | grep '^{' > results.jsonl
cat results.jsonl | jq '.["sci.sci_mgco2eq"]'
```

To append to a shared log (compatible with sci-profiler-php):

```bash
npx tsx examples/hello_world.ts 2>/dev/null | grep '^{' >> /tmp/sci-profiler/sci-profiler.jsonl
```
