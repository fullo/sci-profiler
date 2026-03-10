# SCI Measurement Methodology

This document explains the scientific basis for how `sci-profiler` measures Software Carbon Intensity (SCI) for client-side operations.

## The SCI Formula

The [Green Software Foundation SCI specification](https://sci-guide.greensoftware.foundation/) defines:

```
SCI = ((E × I) + M) / R
```

| Variable | Description | Unit |
|----------|-------------|------|
| **E** | Energy consumed by the operation | kWh |
| **I** | Carbon intensity of the electricity grid | gCO₂eq/kWh |
| **M** | Embodied emissions amortized to the operation | gCO₂eq |
| **R** | Functional unit | 1 operation |

The result is expressed in **mgCO₂eq per operation** (milligrams of CO₂ equivalent).

## Why Wall Time

### What is wall time?

**Wall time** (wall-clock time) is the real elapsed time between the start and end of an operation, as measured by an external clock. It is the duration a user would perceive waiting for an operation to complete.

In browsers, we measure it via the [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now):

```ts
const t0 = performance.now();
await operation();
const t1 = performance.now();
const wallTimeMs = t1 - t0;  // milliseconds, ~5μs resolution
```

`performance.now()` returns a high-resolution timestamp from a monotonic clock. It is not affected by system clock adjustments (NTP, manual changes) and provides microsecond-level precision in modern browsers.

### Wall time vs CPU time

| Metric | What it measures | Includes idle/wait? |
|--------|-----------------|-------------------|
| **Wall time** | Real elapsed time (start to finish) | Yes |
| **CPU time** | Time the CPU spent executing instructions | No |

The relationship is: **wall time >= CPU time**, always.

The gap between them depends on the workload type:

- **CPU-bound** (math, rendering, parsing): wall time ≈ CPU time, because the CPU is continuously active
- **I/O-bound** (network requests, disk reads): wall time >> CPU time, because the CPU idles while waiting for I/O
- **Mixed**: somewhere in between

For **client-side browser operations running in Web Workers** — which is the primary use case of this profiler — operations are almost entirely CPU-bound. There is no disk I/O, no network calls, and no UI thread contention. The Web Worker runs the operation to completion on a dedicated thread. In this context, **wall time is a close approximation of CPU time**.

### Why not measure CPU cycles directly?

Browsers do not expose hardware performance counters (like `rdtsc` on x86 or `perf_events` on Linux). This is intentional — exposing cycle-accurate timing creates side-channel attack vectors (Spectre, Meltdown). The `performance.now()` API is the highest-resolution timing primitive available in browser environments.

Server-side tools like `perf stat` or Intel RAPL can measure actual CPU cycles and energy consumption at the hardware level, but these are not available in the browser sandbox.

### Why wall time works for energy estimation

The energy consumed by a device during an operation is:

```
E (kWh) = P (W) × t (s) / 3,600,000
```

Where:
- **P** is the device's average power draw during the operation (Watts)
- **t** is the operation duration (seconds)

Wall time provides `t`. The key insight is that for CPU-bound operations in Web Workers:

1. The CPU is **continuously engaged** — there are no idle periods where it drops to lower power states
2. The power draw is **approximately constant** during the operation, because the CPU stays in its active P-state
3. Wall time is therefore a **reliable proxy for the duration of energy consumption**

This makes the energy estimate: `E = P_device × wall_time / 3,600,000`

For I/O-bound operations where the CPU may idle, wall time produces a **conservative upper bound** — it slightly overestimates energy because it includes periods where the CPU may consume less than the nominal power. This is an acceptable trade-off: overestimating carbon intensity encourages optimization, while underestimating could give a false sense of efficiency.

## Energy Model (E)

We use a **constant average power model**:

```
E (kWh) = DEVICE_POWER_W × wall_time_seconds / 3,600,000
```

### Why constant power, not variable?

Modern CPUs dynamically adjust power draw based on workload (DVFS — Dynamic Voltage and Frequency Scaling). A MacBook Pro M1 Pro ranges from ~4W at idle to ~30W at peak. However:

1. **We can't measure real-time power in the browser** — Apple's powermetrics, Intel RAPL, and NVIDIA SMI are all OS-level APIs unavailable to web applications
2. **For short CPU-bound bursts, power is relatively stable** — the CPU ramps to its active frequency quickly (< 1ms) and stays there for the duration of the operation
3. **An average value captures the steady-state well** — the default 18W represents the software-attributable power during typical processing (not the SoC's full TDP)

The constant power assumption is the standard approach in the SCI specification for client-side estimation. Users can improve accuracy by measuring their device's actual power draw during typical workloads using external tools (e.g., `powermetrics` on macOS, `turbostat` on Linux) and updating the `devicePowerW` parameter.

## Carbon Intensity (I)

Carbon intensity represents how much CO₂ is emitted per kWh of electricity consumed. It varies by:

- **Region** — France (~50 gCO₂eq/kWh, mostly nuclear) vs Poland (~700, mostly coal)
- **Time of day** — renewables produce more during daytime
- **Season** — heating demand affects the grid mix

The default value (332 gCO₂eq/kWh) is the median intensity for GitHub Actions runners, sourced from the [CarbonRunner calculator](https://carbonrunner.io/github-actions-carbon-calculator).

Users should update this to match their local grid. Resources:
- [Electricity Maps](https://app.electricitymaps.com/) — real-time grid intensity by region
- [Our World in Data](https://ourworldindata.org/grapher/carbon-intensity-electricity) — country-level averages

## Embodied Carbon (M)

Embodied carbon represents the CO₂ emitted during manufacturing, transport, and end-of-life of the device — before it ever runs a single line of code.

It is amortized proportionally to how long each operation uses the machine:

```
M (g) = (EMBODIED_TOTAL_G / LIFETIME_HOURS) × (wall_time_seconds / 3600)
```

### Default values (Apple LCA)

Source: [Apple 14-inch MacBook Pro Product Environmental Report, October 2021](https://www.apple.com/environment/pdf/products/notebooks/14-inch_MacBook_Pro_PER_Oct2021.pdf)

| Lifecycle Phase | Percentage | kg CO₂e |
|-----------------|------------|---------|
| Production | 72% | 195.1 |
| Transport | 5% | 13.6 |
| Use | 22% | 59.6 |
| End-of-life | <1% | ~2.7 |
| **Total** | **100%** | **271** |

**Why we exclude the Use phase**: The SCI formula's `E × I` term already accounts for operational energy. Including the Use phase in M would double-count it. Therefore:

```
M_embodied = 271 - 59.6 ≈ 211 kg CO₂e = 211,000 g
```

**Lifetime hours**: Apple's LCA assumes a 4-year first-owner useful life:

```
4 years × 365 days × 8 hours/day = 11,680 hours
```

Users should substitute their own device's LCA data. Most major manufacturers publish Product Environmental Reports (PERs) or Product Carbon Footprints (PCFs).

## Limitations

1. **Wall time vs CPU time**: Wall-clock time includes any OS scheduling overhead or background process interference. For short operations (< 10ms), this noise can be significant relative to the measurement.

2. **Constant power assumption**: Real power draw varies with workload intensity. The estimate is most accurate for sustained CPU-bound operations and less accurate for mixed or I/O-bound workloads.

3. **Browser timing resolution**: `performance.now()` resolution varies by browser. Most modern browsers provide 5μs resolution, but some may reduce it to 100μs for security (Spectre mitigations). Operations under 1ms may not be accurately measured.

4. **Single-run variance**: For reliable results, multiple runs should be averaged. Factors like JIT compilation warmup, garbage collection pauses, and thermal throttling can affect individual measurements.

5. **Heap measurement**: `performance.memory` is Chrome-only. Firefox, Safari, and other browsers return `null` for heap delta.

6. **No GPU accounting**: The energy model only considers CPU power. Operations that heavily use the GPU (e.g., WebGL, canvas compositing) will have their energy underestimated.

## References

- [Green Software Foundation — SCI Specification](https://sci-guide.greensoftware.foundation/)
- [Green Software Foundation — SCI Guide](https://learn.greensoftware.foundation/measurement/)
- [Apple 14-inch MacBook Pro Product Environmental Report (Oct 2021)](https://www.apple.com/environment/pdf/products/notebooks/14-inch_MacBook_Pro_PER_Oct2021.pdf)
- [CarbonRunner — GitHub Actions Carbon Calculator](https://carbonrunner.io/github-actions-carbon-calculator)
- [Electricity Maps — Real-time Carbon Intensity](https://app.electricitymaps.com/)
- [W3C High Resolution Time Specification](https://www.w3.org/TR/hr-time-3/)
