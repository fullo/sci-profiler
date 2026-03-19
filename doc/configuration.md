# Configuration

SCI Profiler supports three configuration methods, applied in order of priority (highest first):

1. **`configureSci()` API** — programmatic, works in all environments
2. **Environment variables** — `SCI_PROFILER_*`, Node.js only
3. **Built-in defaults** — Apple MacBook Pro M1 Pro LCA data

## Programmatic Configuration

Use `configureSci()` to override any parameters. Only supply the values you want to change — omitted fields keep their current value.

```ts
import { configureSci } from './sciProfiler';

configureSci({
    devicePowerW: 25,
    carbonIntensity: 450,
    embodiedTotalG: 300_000,
    lifetimeHours: 14_600,
    lcaSource: 'Dell XPS 15 Product Carbon Footprint 2024',
    machine: 'Dell XPS 15 9530, i7-13700H, 32GB, Ubuntu 24.04',
});
```

### `getSciConfig()`

Returns a copy of the current configuration (safe to modify without side effects):

```ts
import { getSciConfig } from './sciProfiler';

const config = getSciConfig();
console.log(config.devicePowerW); // 18
```

### `resetSciConfig()`

Resets all parameters to built-in defaults:

```ts
import { resetSciConfig } from './sciProfiler';

resetSciConfig();
```

## Environment Variables (Node.js Only)

In Node.js, configuration can be set via environment variables prefixed with `SCI_PROFILER_`. These are read once at module load time, before any `configureSci()` calls.

| Variable | Type | Maps to |
|----------|------|---------|
| `SCI_PROFILER_DEVICE_POWER_W` | number | `devicePowerW` |
| `SCI_PROFILER_CARBON_INTENSITY` | number | `carbonIntensity` |
| `SCI_PROFILER_EMBODIED_TOTAL_G` | number | `embodiedTotalG` |
| `SCI_PROFILER_LIFETIME_HOURS` | number | `lifetimeHours` |
| `SCI_PROFILER_LCA_SOURCE` | string | `lcaSource` |
| `SCI_PROFILER_MACHINE` | string | `machine` |

### Usage

```bash
# Set via shell
SCI_PROFILER_DEVICE_POWER_W=25 SCI_PROFILER_CARBON_INTENSITY=50 npx tsx your-script.ts

# Or export for the session
export SCI_PROFILER_MACHINE="CI Runner Ubuntu 22.04"
export SCI_PROFILER_CARBON_INTENSITY=50
npx tsx your-script.ts
```

### Priority

Environment variables override built-in defaults but are overridden by `configureSci()`:

```
Built-in defaults → env vars (Node.js only) → configureSci() calls
```

## Built-in Defaults

| Parameter | Default | Unit | Source |
|-----------|---------|------|--------|
| `devicePowerW` | 18 | Watts | M1 Pro: CPU ~7W + mem ctrl ~6W + SSD/system ~5W |
| `carbonIntensity` | 332 | gCO₂eq/kWh | GitHub Actions median (CarbonRunner) |
| `embodiedTotalG` | 211,000 | gCO₂e | Apple LCA: 271kg total − 59.6kg use-phase |
| `lifetimeHours` | 11,680 | hours | 4 years × 365 days × 8 hours/day |
| `lcaSource` | `Apple 14-inch MacBook Pro PER Oct 2021` | — | |
| `machine` | `14-inch MacBook Pro M1 Pro, 16GB, macOS 15.3` | — | |

These defaults are shared with [sci-profiler-php](https://github.com/fullo/sci-profiler-php) for cross-platform consistency.

See [METHODOLOGY.md](../METHODOLOGY.md) for the full derivation of each default value.

## SciConfig Interface

```ts
interface SciConfig {
    devicePowerW: number;      // Software-attributable device power (Watts)
    carbonIntensity: number;   // Grid carbon intensity (gCO₂eq/kWh)
    embodiedTotalG: number;    // Embodied carbon excluding use-phase (grams CO₂e)
    lifetimeHours: number;     // Device lifetime in hours
    lcaSource: string;         // LCA data source description
    machine: string;           // Machine description for reports
}
```

## Finding Your Device's Values

### Device Power

- **macOS**: `sudo powermetrics --samplers smc -i 1000` (look for CPU package power)
- **Linux**: `cat /sys/class/powercap/intel-rapl:0/energy_uj` (Intel RAPL)
- **Estimation**: check your device's TDP and use ~60-70% as average active power

### Carbon Intensity

- [Electricity Maps](https://app.electricitymaps.com/) — real-time grid intensity by region
- [Our World in Data](https://ourworldindata.org/grapher/carbon-intensity-electricity) — country-level averages

### Embodied Carbon

Most major manufacturers publish Product Environmental Reports (PERs) or Product Carbon Footprints (PCFs):

- [Apple Environmental Reports](https://www.apple.com/environment/#reports-product)
- [Dell Product Carbon Footprints](https://www.dell.com/en-us/dt/corporate/social-impact/advancing-sustainability/sustainable-products-and-services/product-carbon-footprints.htm)
- [Lenovo Eco Declarations](https://www.lenovo.com/us/en/compliance/eco-declaration/)

Remember to subtract the "Use" phase from the total to avoid double-counting with the `E × I` term.
