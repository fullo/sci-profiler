# SCI Profiler TypeScript — Development Guidelines

## Project Overview

Framework-agnostic Software Carbon Intensity (SCI) profiler for TypeScript/JavaScript applications. Measures carbon footprint of any async operation using the Green Software Foundation's SCI formula: `SCI = ((E × I) + M) / R`.

Works in both Node.js and browser environments. Zero production dependencies.

## Key Commands

```bash
npm test               # Run Vitest test suite
npm run build          # Compile TypeScript to dist/
npm run example        # Run hello_world example with tsx
npx tsx examples/profile_the_profiler.ts  # Profile the profiler itself
```

## Pre-Push Checklist

Before every push to the repository:

1. **Run the test suite**: `npm test` — all tests must pass
2. **Build**: `npm run build` — must compile without errors
3. **Quick smoke test**: verify the example works:
   ```bash
   npm run example
   ```
4. **Profile the profiler**: run the self-benchmark and verify per-call overhead stays within expected range:
   ```bash
   npx tsx examples/profile_the_profiler.ts
   ```
5. **Update ALL documentation**: this is **mandatory** after every code change. Documents to check and update:
   - `README.md` — API reference, examples, feature list
   - `METHODOLOGY.md` — if SCI calculation or energy model changed
   - `doc/configuration.md` — if config options or env vars changed
   - `doc/reporters.md` — if output formats changed
   - `doc/cross-platform.md` — if JSON fields or PHP compatibility changed
   - `.claude/CLAUDE.md` (this file) — if architecture or guidelines changed
   - Examples in `examples/` — must reflect current API

## Documentation Policy

**Documentation is not optional.** Every code change that modifies public APIs, adds features, changes behavior, or alters output formats MUST include corresponding documentation updates in the same commit. Undocumented changes are incomplete changes.

## Self-Profiling

The profiler tracks its own carbon footprint over time via `examples/profile_the_profiler.ts`. This meta-benchmark measures per-call cost of every public function. Run it after any performance-sensitive change to detect regressions.

Expected per-call overhead (baseline):

| Function | Expected (μs) | Threshold |
|----------|--------------|-----------|
| `getSciConfig()` | < 1 | < 5 μs |
| `profileTool()` no-op | < 5 | < 20 μs |
| `toJsonLine()` | < 5 | < 20 μs |
| `configureSci()` | < 10 | < 50 μs |
| `generateJsonReport(100)` | < 20 | < 100 μs |
| `generateMarkdownReport(100)` | < 50 | < 200 μs |

If any function exceeds its threshold, investigate before pushing.

## Architecture

- `src/sciProfiler.ts` — single-file profiler (core module, zero dependencies)
- `examples/hello_world.ts` — complete working example
- `examples/profile_the_profiler.ts` — self-benchmark (profile the profiler)
- `tests/sciProfiler.test.ts` — Vitest test suite
- `METHODOLOGY.md` — scientific methodology and LCA data sources
- `doc/configuration.md` — all configuration methods
- `doc/reporters.md` — output format documentation
- `doc/cross-platform.md` — PHP compatibility guide
- `doc/example-react.md` — React / Next.js integration guide
- `doc/example-angular.md` — Angular integration guide
- `doc/example-vite.md` — Vite / build tools integration guide
- `doc/example-node.md` — Node.js / Express / Fastify integration guide

### Core Components (all in `src/sciProfiler.ts`)

- **Configuration** — `SciConfig` interface + `configureSci()` / `resetSciConfig()` / `getSciConfig()` + env vars
- **Profiling** — `profileTool<T>()` — profiles any async operation
- **SCI Calculator** — energy, operational carbon, embodied carbon, total SCI
- **Reporters** — `toJsonLine()` (PHP-compatible flat format), `generateJsonLines()`, `generateJsonReport()` (legacy), `generateMarkdownReport()`, `printResult()`, `printSummary()`

### JSON Report Format

Two formats are supported:

1. **JSONL flat format** (preferred, PHP-compatible via `toJsonLine()`):
   ```json
   {"profile_id":"uuid","timestamp":"ISO","tool":"name","time.wall_time_ms":45,"sci.sci_mgco2eq":0.092}
   ```

2. **Legacy nested format** (deprecated, via `generateJsonReport()`):
   ```json
   {"commit":"...","results":[...],"totalSciMg":...}
   ```

## Coding Standards

- Strict TypeScript (`"strict": true` in tsconfig)
- Zero production dependencies — the profiler is a single self-contained file
- All exported functions and types must have JSDoc comments
- All public APIs must have corresponding tests
- Console output must work in both Node.js and browser (detect environment)
- Use `snake_case` for JSON output fields (PHP compatibility)
- Use `camelCase` for TypeScript interfaces and function names
- Default constants sourced from Apple LCA data (documented in METHODOLOGY.md)

## Cross-Platform Compatibility

The JSON report format (flat dot-notation) is designed to be compatible with [sci-profiler-php](https://github.com/fullo/sci-profiler-php). Shared field names:

- `time.wall_time_ms`, `time.wall_time_sec`
- `sci.energy_kwh`, `sci.operational_carbon_gco2eq`, `sci.embodied_carbon_gco2eq`
- `sci.sci_gco2eq`, `sci.sci_mgco2eq`
- `config.device_power_w`, `config.carbon_intensity`, `config.embodied_total_g`, `config.lifetime_hours`

Both profilers use the same default constants (18W, 332 gCO2eq/kWh, 211000g embodied, 11680h lifetime).
