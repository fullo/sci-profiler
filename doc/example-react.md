# React / Next.js Integration

Measure the carbon footprint of React component rendering, data fetching, and user interactions.

## What to Measure

In a React application, the **functional unit** is a user-facing operation:

| Functional Unit | Example | Why It Matters |
|-----------------|---------|----------------|
| Component render | `<Dashboard />` mount | Repeated on every page visit |
| Data fetch + transform | `useQuery` → parse → display | Happens on every API call |
| User interaction | Form submit, filter, sort | Triggered per user action |
| SSR page generation | Next.js `getServerSideProps` | Runs on every request server-side |
| Static build | Next.js `getStaticProps` | Runs once per build, scales with pages |

**Don't profile**: individual `useState` calls, React internals, or trivial DOM updates. Focus on operations the user waits for.

## Integration

### Custom hook

Create a reusable hook for profiling any async operation in your components:

```tsx
// hooks/useSciProfile.ts
import { profileTool, printResult } from 'sci-profiler/src/sciProfiler';
import type { ProfileResult } from 'sci-profiler/src/sciProfiler';
import { useCallback, useRef } from 'react';

export function useSciProfile() {
    const results = useRef<ProfileResult[]>([]);

    const profile = useCallback(async <T,>(
        name: string,
        operation: () => Promise<T>,
        inputBytes?: number,
        measureOutput?: (result: T) => number,
    ): Promise<T> => {
        // Capture the operation result inside the profiled closure
        let operationResult: T;
        const profiled = await profileTool(name, async () => {
            operationResult = await operation();
            return operationResult;
        }, inputBytes, measureOutput);

        printResult(profiled);
        results.current.push(profiled);

        // Return the operation result, not the ProfileResult
        return operationResult!;
    }, []);

    return { profile, results: results.current };
}
```

### Profiling data fetching

```tsx
// components/UserList.tsx
import { useEffect, useState } from 'react';
import { profileTool, toJsonLine } from 'sci-profiler/src/sciProfiler';

export function UserList() {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        (async () => {
            let fetchedUsers: any[];
            const profiled = await profileTool(
                'fetch-users',
                async () => {
                    const res = await fetch('/api/users');
                    fetchedUsers = await res.json();
                    return fetchedUsers;
                },
                0,
                (data) => JSON.stringify(data).length,
            );

            setUsers(fetchedUsers!); // use the captured data, not ProfileResult

            // Send SCI data to your analytics
            if (process.env.NODE_ENV === 'development') {
                console.log(JSON.stringify(toJsonLine(profiled)));
            }
        })();
    }, []);

    return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

### Profiling component rendering

Measure how much carbon a heavy render costs:

```tsx
import { profileTool, printResult } from 'sci-profiler/src/sciProfiler';

async function measureRender() {
    const result = await profileTool(
        'dashboard-render',
        async () => {
            const { renderToString } = await import('react-dom/server');
            const html = renderToString(<Dashboard data={bigDataset} />);
            return html;
        },
        JSON.stringify(bigDataset).length,
        (html) => html.length,
    );
    printResult(result);
}
```

### Next.js Server-Side Rendering

Profile `getServerSideProps` to measure server-side carbon cost:

```tsx
// pages/dashboard.tsx
import { profileTool, toJsonLine } from 'sci-profiler/src/sciProfiler';
import { appendFileSync } from 'fs';

export async function getServerSideProps(context) {
    let data: any;
    const profiled = await profileTool(
        'ssr-dashboard',
        async () => {
            data = await fetchDashboardData(context.params.id);
            return data;
        },
    );

    // Append to JSONL log (same format as sci-profiler-php)
    appendFileSync('/tmp/sci-profiler/sci-profiler.jsonl',
        JSON.stringify(toJsonLine(profiled)) + '\n'
    );

    return { props: { data } };
}
```

### Next.js Static Generation

Profile build-time page generation:

```tsx
// pages/posts/[slug].tsx
import { profileTool, generateJsonLines } from 'sci-profiler/src/sciProfiler';

const buildResults = [];

export async function getStaticProps({ params }) {
    let props: any;
    const profiled = await profileTool(
        `ssg-post-${params.slug}`,
        async () => {
            const post = await getPostBySlug(params.slug);
            const html = await markdownToHtml(post.content);
            props = { post: { ...post, html } };
            return props;
        },
    );

    buildResults.push(profiled);
    return { props };
}

// In a build script, after all pages are generated:
// console.log(generateJsonLines(buildResults));
```

## Configuration

```tsx
// lib/sci-config.ts — import once at app entry point
import { configureSci } from 'sci-profiler/src/sciProfiler';

// Only configure in development/staging
if (process.env.NODE_ENV !== 'production') {
    configureSci({
        devicePowerW: 15,
        machine: process.env.SCI_PROFILER_MACHINE || 'Dev MacBook Air M2',
    });
}
```

Or via environment variables in `.env.local`:

```bash
SCI_PROFILER_DEVICE_POWER_W=15
SCI_PROFILER_CARBON_INTENSITY=50
SCI_PROFILER_MACHINE="Dev MacBook Air M2, 8GB"
```

## Analysis

### Find the most expensive renders

```bash
# Extract SCI scores from dev console output
grep '^{' /tmp/sci-profiler/sci-profiler.jsonl | \
  jq -r '[.tool, .["sci.sci_mgco2eq"]] | @tsv' | \
  sort -t$'\t' -k2 -rn | head -10
```

### Compare SSR vs SSG carbon cost

```bash
# SSR pages (per-request cost)
grep '^{' sci-results.jsonl | \
  jq 'select(.tool | startswith("ssr-"))' | \
  jq -s '{ssr_total: [.[]["sci.sci_mgco2eq"]] | add, ssr_count: length}'

# SSG pages (one-time build cost)
grep '^{' sci-results.jsonl | \
  jq 'select(.tool | startswith("ssg-"))' | \
  jq -s '{ssg_total: [.[]["sci.sci_mgco2eq"]] | add, ssg_count: length}'
```

### Track data fetching cost over time

```bash
# Average SCI for fetch operations
grep '^{' sci-results.jsonl | \
  jq 'select(.tool | startswith("fetch-"))' | \
  jq -s '{avg_sci: ([.[]["sci.sci_mgco2eq"]] | add / length), avg_time_ms: ([.[]["time.wall_time_ms"]] | add / length)}'
```

## Common Optimizations

| Pattern | Problem | Fix |
|---------|---------|-----|
| Large bundle re-render | High SCI on `dashboard-render` | Code split, lazy load heavy components |
| Redundant fetches | Multiple `fetch-*` for same data | Add caching layer (SWR, React Query) |
| SSR for static content | High per-request `ssr-*` cost | Switch to SSG (`getStaticProps`) |
| Unoptimized images | Large `io.output_bytes` on render | Use `next/image`, WebP, lazy loading |
| Client-side JSON parsing | High SCI on data transform | Move transforms to API, return minimal payload |

## CI Integration

```bash
#!/bin/bash
# ci/carbon-budget.sh — fail if SCI exceeds budget

MAX_SCI_PER_RENDER=100  # mgCO₂eq budget per render

npm run build 2>/dev/null
npx tsx benchmark/render-test.ts 2>/dev/null | grep '^{' > results.jsonl

WORST=$(cat results.jsonl | jq -s '[.[]["sci.sci_mgco2eq"]] | max')
echo "Worst render SCI: ${WORST} mgCO₂eq (budget: ${MAX_SCI_PER_RENDER})"

if (( $(echo "$WORST > $MAX_SCI_PER_RENDER" | bc -l) )); then
    echo "FAIL: Carbon budget exceeded"
    exit 1
fi
```
