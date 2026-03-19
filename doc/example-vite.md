# Vite / Build Tools Integration

Measure the carbon footprint of build pipelines, bundling, and dev server operations with Vite, Webpack, esbuild, or any Node.js-based toolchain.

## What to Measure

In a build pipeline, the **functional unit** is a build step or transformation:

| Functional Unit | Example | Why It Matters |
|-----------------|---------|----------------|
| Full build | `vite build` | Runs on every deploy, CI runs |
| Bundle generation | JS/CSS chunk creation | Heaviest build step |
| Asset transform | Image optimization, SVG → component | Can dominate build time |
| TypeScript compilation | `tsc` or esbuild transpile | Runs on every save in dev |
| Dev server HMR | Hot module replacement cycle | Runs dozens of times per dev session |
| Test suite | `vitest run` | Runs on every commit |

## Integration

### Vite Plugin

Create a custom Vite plugin that profiles build steps:

```typescript
// vite-plugin-sci.ts
import { profileTool, toJsonLine, generateJsonLines, configureSci } from 'sci-profiler/src/sciProfiler';
import type { ProfileResult } from 'sci-profiler/src/sciProfiler';
import type { Plugin } from 'vite';
import { appendFileSync } from 'fs';

export function sciProfilerPlugin(): Plugin {
    const results: ProfileResult[] = [];
    let buildStart: number;

    return {
        name: 'vite-plugin-sci-profiler',

        buildStart() {
            buildStart = performance.now();
        },

        async generateBundle(options, bundle) {
            // Profile the bundling phase
            const bundleSize = Object.values(bundle).reduce((sum, chunk) => {
                if (chunk.type === 'chunk') return sum + chunk.code.length;
                if (chunk.type === 'asset' && typeof chunk.source === 'string') return sum + chunk.source.length;
                return sum;
            }, 0);

            const result = await profileTool(
                'vite-generate-bundle',
                async () => bundle,
                0,
                () => bundleSize,
            );
            results.push(result);
        },

        closeBundle() {
            if (results.length > 0) {
                const jsonl = generateJsonLines(results);
                console.log('\n[SCI] Build carbon footprint:');
                console.log(jsonl);

                // Append to log file
                const lines = results.map(r => JSON.stringify(toJsonLine(r))).join('\n') + '\n';
                appendFileSync('/tmp/sci-profiler/vite-build.jsonl', lines);
            }
        },
    };
}
```

Use in `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { sciProfilerPlugin } from './vite-plugin-sci';

export default defineConfig({
    plugins: [
        sciProfilerPlugin(),
    ],
});
```

### Profile the full build

Wrap the entire build command:

```typescript
// scripts/profiled-build.ts
import { profileTool, toJsonLine, printResult, printSummary } from 'sci-profiler/src/sciProfiler';
import { execSync } from 'child_process';
import { statSync, readdirSync } from 'fs';
import { join } from 'path';

function getDirSize(dir: string): number {
    let size = 0;
    for (const file of readdirSync(dir, { recursive: true, withFileTypes: true })) {
        if (file.isFile()) {
            size += statSync(join(file.parentPath, file.name)).size;
        }
    }
    return size;
}

// Profile TypeScript compilation
const tscResult = await profileTool(
    'tsc-compile',
    async () => execSync('npx tsc --noEmit', { encoding: 'utf8' }),
);

// Profile Vite build
const viteResult = await profileTool(
    'vite-build',
    async () => execSync('npx vite build', { encoding: 'utf8' }),
    0,
    () => getDirSize('dist'),
);

// Profile test suite
const testResult = await profileTool(
    'vitest-run',
    async () => execSync('npx vitest run', { encoding: 'utf8' }),
);

const results = [tscResult, viteResult, testResult];
printSummary(results);

// Output JSONL for tracking
for (const r of results) {
    console.log(JSON.stringify(toJsonLine(r)));
}
```

### Profile dev server startup

```typescript
// scripts/profile-dev.ts
import { profileTool, printResult, toJsonLine } from 'sci-profiler/src/sciProfiler';
import { createServer } from 'vite';

const startupResult = await profileTool(
    'vite-dev-startup',
    async () => {
        const server = await createServer();
        await server.listen();
        return server;
    },
);
printResult(startupResult);

// Profile HMR by watching for changes
console.log('Dev server running. Monitoring HMR cycles...');
console.log('Press Ctrl+C to see summary.');
```

### Profile individual transforms

```typescript
// scripts/profile-transforms.ts
import { profileTool, printSummary, generateJsonLines } from 'sci-profiler/src/sciProfiler';
import { readFileSync } from 'fs';
import { transform } from 'esbuild';

const sourceFiles = ['src/app.tsx', 'src/utils.ts', 'src/heavy-component.tsx'];
const results = [];

for (const file of sourceFiles) {
    const source = readFileSync(file, 'utf8');

    const result = await profileTool(
        `esbuild-${file}`,
        async () => {
            return transform(source, { loader: 'tsx', target: 'es2022' });
        },
        source.length,
        (output) => output.code.length,
    );
    results.push(result);
}

printSummary(results);
console.log(generateJsonLines(results));
```

## Configuration

For build tools running in CI, use environment variables:

```bash
# .env or CI environment
SCI_PROFILER_DEVICE_POWER_W=65      # CI runner (higher TDP than laptop)
SCI_PROFILER_CARBON_INTENSITY=50     # EU grid, lower intensity
SCI_PROFILER_MACHINE="GitHub Actions ubuntu-latest"
```

In `vite.config.ts`:

```typescript
import { configureSci } from 'sci-profiler/src/sciProfiler';

configureSci({
    devicePowerW: process.env.CI ? 65 : 15,  // CI runners vs local dev
    machine: process.env.CI ? 'CI Runner' : 'Dev MacBook',
});
```

## Analysis

### Compare build steps

```bash
grep '^{' /tmp/sci-profiler/vite-build.jsonl | \
  jq -r '[.tool, .["time.wall_time_ms"], .["sci.sci_mgco2eq"], .["io.output_bytes"]] | @tsv' | \
  column -t -s$'\t'
```

### Track build cost over time

```bash
# Daily build carbon trend
grep '^{' /tmp/sci-profiler/vite-build.jsonl | \
  jq -r '[.timestamp[:10], .["sci.sci_mgco2eq"]] | @tsv' | \
  awk -F'\t' '{sum[$1]+=$2; count[$1]++} END {for(d in sum) print d, sum[d]/count[d]}' | sort
```

### Identify expensive files

```bash
grep '^{' /tmp/sci-profiler/vite-build.jsonl | \
  jq 'select(.tool | startswith("esbuild-"))' | \
  jq -r '[.tool, .["sci.sci_mgco2eq"], .["io.input_bytes"], .["io.output_bytes"]] | @tsv' | \
  sort -t$'\t' -k2 -rn | head -10
```

## Common Optimizations

| Pattern | Problem | Fix |
|---------|---------|-----|
| Full rebuild on every save | High cumulative SCI in dev | Enable Vite HMR (default), avoid `tsc` watch |
| Large bundle size | High `io.output_bytes` + SCI | Code split, tree shake, dynamic imports |
| Unoptimized images in build | Long `vite-build` time | Use `vite-plugin-imagemin`, serve WebP |
| TypeScript full check | `tsc-compile` dominates | Use `tsc --noEmit` only in CI, esbuild in dev |
| Test suite too heavy | High `vitest-run` SCI | Parallelize, use `vitest --changed` |
| Repeated CI builds | Builds on every push | Cache `node_modules` and build artifacts |

## CI Integration

```bash
#!/bin/bash
# ci/build-carbon-budget.sh

MAX_BUILD_SCI=5000  # mgCO₂eq budget for full build

npx tsx scripts/profiled-build.ts 2>/dev/null | grep '^{' > build-results.jsonl

TOTAL=$(cat build-results.jsonl | jq -s '[.[]["sci.sci_mgco2eq"]] | add')
echo "Build SCI: ${TOTAL} mgCO₂eq (budget: ${MAX_BUILD_SCI})"

if (( $(echo "$TOTAL > $MAX_BUILD_SCI" | bc -l) )); then
    echo "FAIL: Build carbon budget exceeded"
    cat build-results.jsonl | jq -r '[.tool, .["sci.sci_mgco2eq"]] | @tsv' | sort -t$'\t' -k2 -rn
    exit 1
fi

echo "PASS: Build within carbon budget"
```

### GitHub Actions workflow

```yaml
# .github/workflows/carbon-budget.yml
name: Carbon Budget Check
on: [push]

jobs:
  carbon-check:
    runs-on: ubuntu-latest
    env:
      SCI_PROFILER_DEVICE_POWER_W: 65
      SCI_PROFILER_CARBON_INTENSITY: 332
      SCI_PROFILER_MACHINE: "GitHub Actions ubuntu-latest"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx tsx scripts/profiled-build.ts 2>/dev/null | grep '^{' > build-results.jsonl
      - run: |
          TOTAL=$(cat build-results.jsonl | jq -s '[.[]["sci.sci_mgco2eq"]] | add')
          echo "Build SCI: ${TOTAL} mgCO₂eq"
          echo "sci_total=${TOTAL}" >> $GITHUB_OUTPUT
```
