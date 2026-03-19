# Angular Integration

Measure the carbon footprint of Angular component lifecycle, HTTP calls, and reactive pipelines.

## What to Measure

In an Angular application, the **functional unit** is a user-facing operation:

| Functional Unit | Example | Why It Matters |
|-----------------|---------|----------------|
| Route resolve + render | Navigate to `/dashboard` | Repeated on every navigation |
| HTTP request + transform | `HttpClient.get()` → pipe → display | Happens per API call |
| Reactive pipeline | `Observable` chain with operators | Core of Angular data flow |
| Form validation + submit | Reactive form → validate → POST | Per user action |
| SSR page render | Angular Universal `renderModule()` | Per request server-side |

## Integration

### Service wrapper

Create an injectable service for profiling operations across your app:

```typescript
// services/sci-profile.service.ts
import { Injectable } from '@angular/core';
import { profileTool, toJsonLine, printResult } from 'sci-profiler/src/sciProfiler';
import type { ProfileResult } from 'sci-profiler/src/sciProfiler';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class SciProfileService {
    private results: ProfileResult[] = [];

    async profile<T>(
        name: string,
        operation: () => Promise<T>,
        inputBytes = 0,
        measureOutput?: (result: T) => number,
    ): Promise<ProfileResult> {
        const result = await profileTool(name, operation, inputBytes, measureOutput);

        if (!environment.production) {
            printResult(result);
        }

        this.results.push(result);
        return result;
    }

    getResults(): ProfileResult[] {
        return [...this.results];
    }

    getJsonLines(): string {
        return this.results.map(r => JSON.stringify(toJsonLine(r))).join('\n');
    }
}
```

### Profiling HTTP interceptor

Automatically profile all HTTP requests:

```typescript
// interceptors/sci-http.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { profileTool, toJsonLine, printResult } from 'sci-profiler/src/sciProfiler';

@Injectable()
export class SciHttpInterceptor implements HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const startTime = performance.now();

        return next.handle(req).pipe(
            tap(event => {
                if (event instanceof HttpResponse) {
                    const wallTimeMs = performance.now() - startTime;
                    const inputBytes = req.body ? JSON.stringify(req.body).length : 0;
                    const outputBytes = event.body ? JSON.stringify(event.body).length : 0;

                    // Log as manual measurement (bypass profileTool for sync reporting)
                    console.log(JSON.stringify({
                        tool: `http-${req.method.toLowerCase()}-${new URL(req.url).pathname}`,
                        'time.wall_time_ms': Math.round(wallTimeMs),
                        'io.input_bytes': inputBytes,
                        'io.output_bytes': outputBytes,
                    }));
                }
            })
        );
    }
}
```

Register in `app.module.ts`:

```typescript
providers: [
    { provide: HTTP_INTERCEPTORS, useClass: SciHttpInterceptor, multi: true },
]
```

### Profiling component initialization

```typescript
// components/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { SciProfileService } from '../services/sci-profile.service';

@Component({ selector: 'app-dashboard', templateUrl: './dashboard.component.html' })
export class DashboardComponent implements OnInit {
    data: any;

    constructor(
        private sci: SciProfileService,
        private api: ApiService,
    ) {}

    async ngOnInit() {
        await this.sci.profile(
            'dashboard-init',
            async () => {
                this.data = await this.api.getDashboardData().toPromise();
            },
        );
    }
}
```

### Profiling reactive pipelines

Wrap Observable chains with profiling:

```typescript
import { profileTool, printResult } from 'sci-profiler/src/sciProfiler';
import { from, switchMap } from 'rxjs';

// Profile an Observable pipeline by wrapping it in profileTool
loadUsers$ = this.searchTerm$.pipe(
    switchMap(term =>
        from(profileTool(
            `search-users-${term}`,
            async () => {
                const response = await fetch(`/api/users?q=${term}`);
                return response.json();
            },
            term.length,
            (users) => JSON.stringify(users).length,
        )).pipe(
            tap(result => printResult(result)),
        )
    ),
);
```

### Angular Universal (SSR)

Profile server-side rendering:

```typescript
// server.ts
import { profileTool, toJsonLine } from 'sci-profiler/src/sciProfiler';
import { appendFileSync } from 'fs';

server.get('*', async (req, res) => {
    const result = await profileTool(
        `ssr-${req.url}`,
        async () => {
            return await renderModule(AppServerModule, {
                document: indexHtml,
                url: req.url,
            });
        },
        0,
        (html) => html.length,
    );

    appendFileSync('/tmp/sci-profiler/sci-profiler.jsonl',
        JSON.stringify(toJsonLine(result)) + '\n'
    );

    res.send(result);
});
```

## Configuration

In `main.ts` or `environment.ts`:

```typescript
// environments/environment.ts
import { configureSci } from 'sci-profiler/src/sciProfiler';

if (!environment.production) {
    configureSci({
        devicePowerW: 15,
        machine: 'Dev MacBook Air M2',
    });
}
```

Or via `angular.json` environment variables:

```json
{
  "configurations": {
    "staging": {
      "fileReplacements": [...],
      "env": {
        "SCI_PROFILER_DEVICE_POWER_W": "15",
        "SCI_PROFILER_MACHINE": "CI Runner"
      }
    }
  }
}
```

## Analysis

### Find slowest routes

```bash
grep '^{' sci-results.jsonl | \
  jq 'select(.tool | startswith("ssr-"))' | \
  jq -r '[.tool, .["time.wall_time_ms"], .["sci.sci_mgco2eq"]] | @tsv' | \
  sort -t$'\t' -k3 -rn | head -10
```

### Compare HTTP endpoint costs

```bash
grep '^{' sci-results.jsonl | \
  jq 'select(.tool | startswith("http-"))' | \
  jq -r '[.tool, .["sci.sci_mgco2eq"]] | @tsv' | \
  sort -t$'\t' -k2 -rn
```

### Aggregate by component

```bash
grep '^{' sci-results.jsonl | \
  jq -s 'group_by(.tool | split("-")[0]) | map({component: .[0].tool | split("-")[0], total_sci: [.[]["sci.sci_mgco2eq"]] | add, count: length})'
```

## Common Optimizations

| Pattern | Problem | Fix |
|---------|---------|-----|
| Eager module loading | High SCI on initial route | Lazy load feature modules |
| Redundant HTTP calls | Multiple `http-get-*` for same endpoint | Use `shareReplay()` or caching interceptor |
| Heavy change detection | High SCI on re-render | Use `OnPush` strategy, `trackBy` in `*ngFor` |
| SSR for static routes | High per-request `ssr-*` cost | Pre-render with `angular-prerender` |
| Large reactive chains | High SCI on Observable pipelines | Use `distinctUntilChanged`, debounce inputs |

## CI Integration

```bash
#!/bin/bash
# ci/angular-carbon-check.sh

ng build --configuration=staging 2>/dev/null
node dist/server/main.js &
SERVER_PID=$!
sleep 3

# Profile key routes
for route in "/" "/dashboard" "/users" "/settings"; do
    curl -s "http://localhost:4000${route}" > /dev/null
done

kill $SERVER_PID
cat /tmp/sci-profiler/sci-profiler.jsonl | \
  jq -s '{total_sci: [.[]["sci.sci_mgco2eq"]] | add, routes: length}'
```
