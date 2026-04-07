# Node.js / Express / Fastify Integration

Measure the carbon footprint of Node.js backend operations: HTTP request handling, middleware chains, database queries, and background jobs.

## What to Measure

In a Node.js backend, the **functional unit** is a complete server-side operation:

| Functional Unit | Example | Why It Matters |
|-----------------|---------|----------------|
| HTTP request handler | `GET /api/users` → response | Runs per API call |
| Middleware chain | Auth → validate → rate limit | Overhead on every request |
| Database query | `SELECT` / `INSERT` / aggregation | Often the dominant cost |
| Background job | Queue processing, cron tasks | Runs repeatedly, often unmonitored |
| File processing | CSV parse, image resize, PDF gen | CPU-intensive, measurable |

> **Tip**: For full-stack measurement, combine with [sci-profiler-php](https://github.com/fullo/sci-profiler-php) on your PHP services to get a unified JSONL log across your entire backend.

## Integration

### Express middleware

Automatically profile every request:

```typescript
// middleware/sci-profiler.ts
import { profileTool, toJsonLine, getSciConfig } from 'sci-profiler/src/sciProfiler';
import { appendFileSync, mkdirSync } from 'fs';
import type { Request, Response, NextFunction } from 'express';

const LOG_PATH = '/tmp/sci-profiler/sci-profiler.jsonl';
mkdirSync('/tmp/sci-profiler', { recursive: true });

export function sciProfilerMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
        const startTime = performance.now();
        const inputBytes = req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0;

        const originalSend = res.send.bind(res);
        res.send = function (body: any) {
            const outputBytes = typeof body === 'string' ? body.length : Buffer.byteLength(body || '');

            // Profile a no-op to compute SCI for the measured wall time
            profileTool(
                `${req.method.toLowerCase()}-${req.route?.path || req.path}`,
                async () => body,
                inputBytes,
                () => outputBytes,
            ).then(profiled => {
                const line = toJsonLine(profiled);
                appendFileSync(LOG_PATH, JSON.stringify(line) + '\n');
            });

            return originalSend(body);
        };

        next();
    };
}
```

Use in your Express app:

```typescript
import express from 'express';
import { sciProfilerMiddleware } from './middleware/sci-profiler';

const app = express();

// Enable in development/staging only
if (process.env.NODE_ENV !== 'production') {
    app.use(sciProfilerMiddleware());
}
```

### Fastify plugin

```typescript
// plugins/sci-profiler.ts
import { profileTool, toJsonLine } from 'sci-profiler/src/sciProfiler';
import { appendFileSync, mkdirSync } from 'fs';
import type { FastifyPluginAsync } from 'fastify';

const LOG_PATH = '/tmp/sci-profiler/sci-profiler.jsonl';
mkdirSync('/tmp/sci-profiler', { recursive: true });

const sciPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('onRequest', async (request) => {
        (request as any)._sciStart = performance.now();
    });

    fastify.addHook('onResponse', async (request, reply) => {
        const profiled = await profileTool(
            `${request.method.toLowerCase()}-${request.routeOptions?.url || request.url}`,
            async () => undefined, // response already sent
        );

        const line = toJsonLine(profiled);
        appendFileSync(LOG_PATH, JSON.stringify(line) + '\n');
    });
};

export default sciPlugin;
```

### Profiling individual operations

Profile specific heavy operations within your handlers:

```typescript
// routes/users.ts
import { profileTool, toJsonLine, printResult } from 'sci-profiler/src/sciProfiler';
import { appendFileSync } from 'fs';

app.get('/api/users', async (req, res) => {
    // Profile the database query
    const dbResult = await profileTool(
        'db-select-users',
        async () => db.query('SELECT * FROM users WHERE active = true'),
        0,
        (rows) => JSON.stringify(rows).length,
    );

    // Profile the serialization
    const serResult = await profileTool(
        'serialize-users',
        async () => JSON.stringify(dbResult),
        JSON.stringify(dbResult).length,
        (json) => json.length,
    );

    // Log both
    appendFileSync('/tmp/sci-profiler/sci-profiler.jsonl',
        [dbResult, serResult].map(r => JSON.stringify(toJsonLine(r))).join('\n') + '\n'
    );

    res.json(dbResult);
});
```

### Profiling background jobs

```typescript
// jobs/process-queue.ts
import { profileTool, toJsonLine, printSummary } from 'sci-profiler/src/sciProfiler';
import { appendFileSync } from 'fs';

async function processJob(job: Job) {
    const result = await profileTool(
        `job-${job.type}`,
        async () => {
            switch (job.type) {
                case 'send-email': return await sendEmail(job.data);
                case 'resize-image': return await resizeImage(job.data);
                case 'generate-report': return await generateReport(job.data);
            }
        },
        JSON.stringify(job.data).length,
    );

    appendFileSync('/tmp/sci-profiler/jobs.jsonl',
        JSON.stringify(toJsonLine(result)) + '\n'
    );
}
```

### Profiling CLI scripts

```typescript
// scripts/import-data.ts
import { profileTool, printSummary, generateJsonLines, configureSci } from 'sci-profiler/src/sciProfiler';
import { readFileSync } from 'fs';

configureSci({ machine: 'CI Runner Ubuntu 22.04' });

const csvData = readFileSync('data/import.csv', 'utf8');
const results = [];

// Profile CSV parsing
results.push(await profileTool(
    'csv-parse',
    async () => parseCSV(csvData),
    csvData.length,
    (rows) => JSON.stringify(rows).length,
));

// Profile database insert
results.push(await profileTool(
    'db-bulk-insert',
    async () => db.batchInsert('users', parsedRows),
    JSON.stringify(parsedRows).length,
));

// Profile index rebuild
results.push(await profileTool(
    'search-reindex',
    async () => searchEngine.reindex('users'),
));

printSummary(results);
console.log(generateJsonLines(results));
```

## Configuration

### Via environment variables

```bash
# .env
SCI_PROFILER_DEVICE_POWER_W=65        # Server TDP (higher than laptop)
SCI_PROFILER_CARBON_INTENSITY=50       # EU data center
SCI_PROFILER_MACHINE="AWS EC2 t3.medium, eu-west-1"
```

### Programmatic

```typescript
// config/sci.ts
import { configureSci } from 'sci-profiler/src/sciProfiler';

configureSci({
    devicePowerW: process.env.CI ? 65 : 18,
    carbonIntensity: 50,   // Your data center region
    machine: process.env.HOSTNAME || 'dev-machine',
});
```

## Analysis

### Slowest endpoints

```bash
grep '^{' /tmp/sci-profiler/sci-profiler.jsonl | \
  jq -r '[.tool, .["time.wall_time_ms"], .["sci.sci_mgco2eq"]] | @tsv' | \
  sort -t$'\t' -k3 -rn | head -10
```

### Carbon by HTTP method

```bash
grep '^{' /tmp/sci-profiler/sci-profiler.jsonl | \
  jq -s 'group_by(.["request.method"]) | map({method: .[0]["request.method"], total_sci: [.[]["sci.sci_mgco2eq"]] | add, count: length})'
```

### Compare database vs application cost

```bash
# Database operations
grep '^{' /tmp/sci-profiler/sci-profiler.jsonl | \
  jq 'select(.tool | startswith("db-"))' | \
  jq -s '{db_total: [.[]["sci.sci_mgco2eq"]] | add}'

# Application logic
grep '^{' /tmp/sci-profiler/sci-profiler.jsonl | \
  jq 'select(.tool | startswith("db-") | not)' | \
  jq -s '{app_total: [.[]["sci.sci_mgco2eq"]] | add}'
```

### Job queue carbon cost

```bash
grep '^{' /tmp/sci-profiler/jobs.jsonl | \
  jq -s 'group_by(.tool) | map({job: .[0].tool, avg_sci: ([.[]["sci.sci_mgco2eq"]] | add / length), count: length})' | \
  jq 'sort_by(-.avg_sci)'
```

### Unified full-stack analysis (with PHP backend)

```bash
# Merge Node.js and PHP profiling data
cat /tmp/sci-profiler/sci-profiler.jsonl node-results.jsonl > full-stack.jsonl

# Total carbon across all services
cat full-stack.jsonl | jq -s '[.[]["sci.sci_mgco2eq"]] | add'
```

## Common Optimizations

| Pattern | Problem | Fix |
|---------|---------|-----|
| N+1 queries | Multiple `db-select-*` per request | Eager load, use JOINs, DataLoader |
| Large JSON serialization | High SCI on `serialize-*` | Stream responses, paginate, select fields |
| Sync file I/O in handlers | Blocks event loop, high wall time | Use async `fs/promises`, streaming |
| Uncompressed responses | High `io.output_bytes` | Enable gzip/brotli compression |
| Heavy middleware chain | Overhead on every request | Conditional middleware, route-specific |
| Full table scans | Slow `db-select-*` operations | Add indexes, use query explain |
| Redundant background jobs | High cumulative job SCI | Deduplicate, batch, use idempotency keys |

## CI Integration

```bash
#!/bin/bash
# ci/api-carbon-check.sh

# Start server
node dist/server.js &
SERVER_PID=$!
sleep 2

# Run API benchmark
for endpoint in "/api/users" "/api/dashboard" "/api/reports"; do
    for i in $(seq 1 10); do
        curl -s "http://localhost:3000${endpoint}" > /dev/null
    done
done

kill $SERVER_PID

# Check carbon budget
TOTAL=$(cat /tmp/sci-profiler/sci-profiler.jsonl | jq -s '[.[]["sci.sci_mgco2eq"]] | add')
AVG=$(cat /tmp/sci-profiler/sci-profiler.jsonl | jq -s '[.[]["sci.sci_mgco2eq"]] | add / length')
echo "Total: ${TOTAL} mgCO₂eq | Avg per request: ${AVG} mgCO₂eq"
```
