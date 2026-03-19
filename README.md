# SCI Profiler

A framework-agnostic [Software Carbon Intensity (SCI)](https://sci-guide.greensoftware.foundation/) profiler for TypeScript/JavaScript applications. Measures the carbon footprint of any async operation using the Green Software Foundation formula.

**Zero dependencies. Single TypeScript file. Works in Node.js and any browser.**

> Cross-platform companion to [sci-profiler-php](https://github.com/fullo/sci-profiler-php) — same SCI formula, same default constants, compatible JSON output.

## How It Works

```
SCI = ((E × I) + M) / R
```

| Symbol | Description | Default |
|--------|-------------|---------|
| **E** | Energy consumed (kWh) = device power × wall time | 18W |
| **I** | Grid carbon intensity | 332 gCO₂eq/kWh |
| **M** | Embodied emissions (manufacturing, transport) | 211,000 gCO₂e |
| **R** | Functional unit | 1 operation |

The **functional unit** is a complete user-facing operation — a data fetch, a render, a build step — not an individual function call.

## Features

- **Zero dependencies** — single self-contained TypeScript file, copy and use
- **Framework-agnostic** — profile any `async` operation in any runtime
- **Cross-runtime** — works identically in Node.js and browsers
- **PHP-compatible output** — JSONL format shared with [sci-profiler-php](https://github.com/fullo/sci-profiler-php)
- **Multiple reporters** — JSONL, console, markdown, JSON
- **Configurable** — API, environment variables, or built-in defaults from Apple LCA data

## Quick Start

1. **Install** dev dependencies:
   ```bash
   npm install
   ```

2. **Copy** `src/sciProfiler.ts` into your project, then:
   ```ts
   import { profileTool, printResult } from './sciProfiler';

   const result = await profileTool('my-operation', async () => {
       return await processData(input);
   });

   printResult(result);
   // → [SCI] my-operation  42ms  69.874 mgCO₂eq  (E=69.662mg + M=0.211mg)
   ```

3. **Generate** a PHP-compatible JSONL report:
   ```ts
   import { toJsonLine } from './sciProfiler';
   console.log(JSON.stringify(toJsonLine(result)));
   ```

4. **Analyze** with `jq`:
   ```bash
   npx tsx examples/hello_world.ts 2>/dev/null | grep '^{' | jq '.["sci.sci_mgco2eq"]'
   ```

## Documentation

| Document | Description |
|----------|-------------|
| [doc/api-reference.md](doc/api-reference.md) | Full API reference with types and examples |
| [doc/configuration.md](doc/configuration.md) | All configuration methods (API, env vars, defaults) |
| [doc/reporters.md](doc/reporters.md) | Output formats (JSONL, console, markdown, JSON) |
| [doc/cross-platform.md](doc/cross-platform.md) | PHP compatibility, field mapping, analysis workflows |
| [METHODOLOGY.md](METHODOLOGY.md) | SCI formula, energy model, LCA data sources, limitations |

### Framework Integration Guides

| Guide | Description |
|-------|-------------|
| [doc/example-react.md](doc/example-react.md) | React / Next.js — hooks, SSR, SSG, data fetching |
| [doc/example-angular.md](doc/example-angular.md) | Angular — services, interceptors, Universal SSR, RxJS |
| [doc/example-vite.md](doc/example-vite.md) | Vite / build tools — plugins, bundling, HMR, CI pipelines |
| [doc/example-node.md](doc/example-node.md) | Node.js / Express / Fastify — middleware, jobs, CLI scripts |

## Development

```bash
npm test        # Run Vitest test suite (31 tests)
npm run build   # Compile TypeScript to dist/
npm run example # Run hello_world example
```

## Related

- [sci-profiler-php](https://github.com/fullo/sci-profiler-php) — PHP companion (same formula, compatible JSONL)
- [Green Software Foundation — SCI Specification](https://sci-guide.greensoftware.foundation/)
- [Apple MacBook Pro Product Environmental Report (Oct 2021)](https://www.apple.com/environment/pdf/products/notebooks/14-inch_MacBook_Pro_PER_Oct2021.pdf)

## License

[MIT](LICENSE)
