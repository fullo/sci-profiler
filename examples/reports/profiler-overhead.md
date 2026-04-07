# SCI Profiler — Self-Profiling Report

**Date**: 2026-04-07T02:53:35.502Z
**Machine**: MacBook Air M2, 8GB, macOS 15
**Constants**: E power=15W, I=332 gCO₂eq/kWh, M embodied=211000g, lifetime=11680h

## Per-Call Cost (amortized)

| Function | Iterations | Total (ms) | Per call (μs) | Per call SCI (μgCO₂eq) |
|----------|-----------|------------|---------------|------------------------|
| profileTool() no-op | 1,000 | 4 | 4 | 5.5478 |
| toJsonLine() | 100,000 | 164 | 1.64 | 2.2783 |
| generateJsonLines(100) | 1,000 | 249 | 249 | 345.2031 |
| generateMarkdownReport(100) | 10,000 | 366 | 36.6 | 50.8367 |

**Total profiler overhead**: 1086.948 mgCO₂eq across 4 benchmarks
