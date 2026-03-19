# SCI Profiler — Self-Profiling Report

**Date**: 2026-03-19T22:48:12.353Z
**Machine**: MacBook Air M2, 8GB, macOS 15
**Constants**: E power=15W, I=332 gCO₂eq/kWh, M embodied=211000g, lifetime=11680h

## Per-Call Cost (amortized)

| Function | Iterations | Total (ms) | Per call (μs) | Per call SCI (μgCO₂eq) |
|----------|-----------|------------|---------------|------------------------|
| profileTool() no-op | 1,000 | 1 | 1 | 1.1925 |
| toJsonLine() | 100,000 | 137 | 1.37 | 1.9002 |
| generateJsonLines(100) | 1,000 | 240 | 240 | 333.0542 |
| generateMarkdownReport(100) | 10,000 | 366 | 36.6 | 50.8087 |

**Total profiler overhead**: 1032.351 mgCO₂eq across 4 benchmarks
