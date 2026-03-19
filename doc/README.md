# SCI Profiler TypeScript — Documentation

## Reference

| Document | Description |
|----------|-------------|
| [api-reference.md](api-reference.md) | Full API reference — functions, types, interfaces, constants |
| [configuration.md](configuration.md) | All configuration methods: `configureSci()`, env vars, defaults |
| [reporters.md](reporters.md) | Output formats: JSONL, console, markdown, legacy JSON |
| [cross-platform.md](cross-platform.md) | PHP compatibility: field mapping, unified analysis, jq workflows |

## Framework Integration Guides

| Guide | Description |
|-------|-------------|
| [example-react.md](example-react.md) | React / Next.js — custom hooks, SSR, SSG, data fetching profiling |
| [example-angular.md](example-angular.md) | Angular — injectable service, HTTP interceptor, Universal SSR, RxJS |
| [example-vite.md](example-vite.md) | Vite / build tools — Vite plugin, bundle profiling, HMR, CI pipelines |
| [example-node.md](example-node.md) | Node.js / Express / Fastify — middleware, background jobs, CLI scripts |

## Methodology

See [METHODOLOGY.md](../METHODOLOGY.md) in the project root for the scientific basis:

- SCI formula derivation: `SCI = ((E × I) + M) / R`
- Energy model (constant power × wall time)
- Why wall time works for energy estimation
- Embodied carbon amortization from Apple LCA data
- Known limitations (7 documented)

## Examples

Runnable examples are in the [`examples/`](../examples/) directory:

| Example | Command | Description |
|---------|---------|-------------|
| [hello_world.ts](../examples/hello_world.ts) | `npm run example` | Quick start — profile, configure, report |
| [report_formats.ts](../examples/report_formats.ts) | `npx tsx examples/report_formats.ts` | All 5 output formats side by side |
| [profile_the_profiler.ts](../examples/profile_the_profiler.ts) | `npx tsx examples/profile_the_profiler.ts` | Meta-benchmark: SCI cost of the profiler itself |
