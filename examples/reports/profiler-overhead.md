# SCI Profiler — Self-Profiling Report

**Date**: 2026-03-19T22:50:45.888Z
**Machine**: MacBook Air M2, 8GB, macOS 15
**Constants**: E power=15W, I=332 gCO₂eq/kWh, M embodied=211000g, lifetime=11680h

## Per-Call Cost (amortized)

| Function | Iterations | Total (ms) | Per call (μs) | Per call SCI (μgCO₂eq) |
|----------|-----------|------------|---------------|------------------------|
| profileTool() no-op | 1,000 | 1 | 1 | 1.1316 |
| toJsonLine() | 100,000 | 137 | 1.37 | 1.8961 |
| generateJsonLines(100) | 1,000 | 235 | 235 | 325.9132 |
| generateMarkdownReport(100) | 10,000 | 369 | 36.9 | 51.2839 |

**Total profiler overhead**: 1029.494 mgCO₂eq across 4 benchmarks
