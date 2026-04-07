/**
 * SCI (Software Carbon Intensity) profiler — framework-agnostic.
 *
 * Measures wall time via performance.now() around any async operation,
 * then computes SCI = ((E × I) + M) / R per the Green Software Foundation spec.
 *
 * This module has ZERO project-specific dependencies. It can be used with any
 * client-side application by passing an arbitrary async function to profileTool().
 *
 * Default constants sourced from:
 * - Apple 14-inch MacBook Pro Product Environmental Report (Oct 2021)
 * - CarbonRunner GitHub Actions Carbon Calculator (grid intensity)
 * - Eclectic Light Co. (M1 Pro power measurements)
 */

// ── SCI Default Constants ────────────────────────────────────────────────────
/** Software-attributable device power in Watts (M1 Pro: CPU ~7W + mem ctrl ~6W + SSD/system ~5W) */
export const DEFAULT_DEVICE_POWER_W = 18;

/** Grid carbon intensity in gCO2eq/kWh (GitHub Actions median) */
export const DEFAULT_CARBON_INTENSITY = 332;

/** Embodied carbon in grams CO2e (Apple LCA: 271kg total − 59.6kg use-phase) */
export const DEFAULT_EMBODIED_TOTAL_G = 211_000;

/** Expected device lifetime in hours (Apple LCA: 4 years × 365d × 8h/d) */
export const DEFAULT_LIFETIME_HOURS = 11_680;

/** LCA data source description */
export const DEFAULT_LCA_SOURCE = 'Apple 14-inch MacBook Pro PER Oct 2021';

/** Default machine description */
export const DEFAULT_MACHINE = '14-inch MacBook Pro M1 Pro, 16GB, macOS 15.3';

// ── Configurable SCI Parameters ─────────────────────────────────────────────
export interface SciConfig {
    devicePowerW: number;
    carbonIntensity: number;
    embodiedTotalG: number;
    lifetimeHours: number;
    lcaSource: string;
    machine: string;
}

const _config: SciConfig = {
    devicePowerW: DEFAULT_DEVICE_POWER_W,
    carbonIntensity: DEFAULT_CARBON_INTENSITY,
    embodiedTotalG: DEFAULT_EMBODIED_TOTAL_G,
    lifetimeHours: DEFAULT_LIFETIME_HOURS,
    lcaSource: DEFAULT_LCA_SOURCE,
    machine: DEFAULT_MACHINE,
};

// ── Helpers ─────────────────────────────────────────────────────────────────
declare const process: any;

/** Detect if running in Node.js (vs browser). */
const _isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

// ── Environment Variable Support (Node.js only) ────────────────────────────
if (_isNode) {
    const env = process.env;
    const parseNum = (val: string | undefined): number | undefined => {
        if (val === undefined) return undefined;
        const n = Number(val);
        return Number.isFinite(n) ? n : undefined;
    };
    const parsed = {
        devicePowerW: parseNum(env.SCI_PROFILER_DEVICE_POWER_W),
        carbonIntensity: parseNum(env.SCI_PROFILER_CARBON_INTENSITY),
        embodiedTotalG: parseNum(env.SCI_PROFILER_EMBODIED_TOTAL_G),
        lifetimeHours: parseNum(env.SCI_PROFILER_LIFETIME_HOURS),
    };
    if (parsed.devicePowerW !== undefined) _config.devicePowerW = parsed.devicePowerW;
    if (parsed.carbonIntensity !== undefined) _config.carbonIntensity = parsed.carbonIntensity;
    if (parsed.embodiedTotalG !== undefined) _config.embodiedTotalG = parsed.embodiedTotalG;
    if (parsed.lifetimeHours !== undefined) _config.lifetimeHours = parsed.lifetimeHours;
    if (env.SCI_PROFILER_LCA_SOURCE) _config.lcaSource = env.SCI_PROFILER_LCA_SOURCE;
    if (env.SCI_PROFILER_MACHINE) _config.machine = env.SCI_PROFILER_MACHINE;
}

/**
 * Configure SCI parameters for your device. Only supply the values you want
 * to override — omitted fields keep their current value.
 */
export function configureSci(overrides: Partial<SciConfig>): SciConfig {
    Object.assign(_config, overrides);
    if (_isNode) {
        console.log('\x1b[32m[SCI]\x1b[0m Configuration updated:', { ..._config });
    } else {
        console.log('%c[SCI] Configuration updated:', 'color: #22c55e; font-weight: bold', { ..._config });
    }
    return { ..._config };
}

/** Reset all SCI parameters to their defaults. */
export function resetSciConfig(): SciConfig {
    _config.devicePowerW = DEFAULT_DEVICE_POWER_W;
    _config.carbonIntensity = DEFAULT_CARBON_INTENSITY;
    _config.embodiedTotalG = DEFAULT_EMBODIED_TOTAL_G;
    _config.lifetimeHours = DEFAULT_LIFETIME_HOURS;
    _config.lcaSource = DEFAULT_LCA_SOURCE;
    _config.machine = DEFAULT_MACHINE;
    if (_isNode) {
        console.log('\x1b[32m[SCI]\x1b[0m Configuration reset to defaults');
    } else {
        console.log('%c[SCI] Configuration reset to defaults', 'color: #22c55e; font-weight: bold');
    }
    return { ..._config };
}

/** Get a copy of the current SCI configuration. */
export function getSciConfig(): SciConfig {
    return { ..._config };
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface ProfileResult {
    tool: string;
    wallTimeMs: number;
    inputSizeBytes: number;
    outputSizeBytes: number;
    heapDeltaBytes: number | null;
    energyKwh: number;
    carbonOperationalMg: number;
    carbonEmbodiedMg: number;
    sciMgCO2eq: number;
}

/** PHP-compatible flat JSON line format (dot-notation keys). */
export interface JsonLineReport {
    profile_id: string;
    timestamp: string;
    tool: string;
    'time.wall_time_ms': number;
    'time.wall_time_sec': number;
    'memory.heap_delta_bytes': number | null;
    'io.input_bytes': number;
    'io.output_bytes': number;
    'sci.energy_kwh': number;
    'sci.operational_carbon_gco2eq': number;
    'sci.embodied_carbon_gco2eq': number;
    'sci.sci_gco2eq': number;
    'sci.sci_mgco2eq': number;
    'config.device_power_w': number;
    'config.carbon_intensity': number;
    'config.embodied_total_g': number;
    'config.lifetime_hours': number;
    'config.machine': string;
    'config.lca_source': string;
}

function getHeapUsed(): number | null {
    const mem = (performance as any).memory;
    return mem ? mem.usedJSHeapSize : null;
}

/** Generate a unique profile ID. */
function generateProfileId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Core ────────────────────────────────────────────────────────────────────
/**
 * Profile any async operation, measuring wall time and computing SCI.
 *
 * @param name        Human-readable operation name (e.g. 'merge-pdf', 'image-resize')
 * @param operation   The async function to measure — can be anything
 * @param inputBytes  Known input size in bytes (0 if not applicable)
 * @param measureOutput  Optional callback to extract output size from the operation result
 */
export async function profileTool<T = unknown>(
    name: string,
    operation: () => Promise<T>,
    inputBytes: number = 0,
    measureOutput?: (result: T) => number,
): Promise<ProfileResult> {
    const heapBefore = getHeapUsed();

    const t0 = performance.now();
    const result = await operation();
    const t1 = performance.now();

    const heapAfter = getHeapUsed();
    const wallTimeMs = t1 - t0;
    const wallTimeS = wallTimeMs / 1000;

    // E = energy in kWh
    const energyKwh = (_config.devicePowerW * wallTimeS) / 3_600_000;

    // Operational carbon = E × I (in mg for readability)
    const carbonOperationalMg = energyKwh * _config.carbonIntensity * 1_000_000;

    // Embodied carbon amortized to this operation (in mg)
    // M = (embodiedTotalG / lifetimeHours) × (wallTimeS / 3600) → grams, × 1000 → mg
    const carbonEmbodiedMg = (_config.embodiedTotalG / _config.lifetimeHours) * (wallTimeS / 3600) * 1000;

    // SCI = ((E × I) + M) / R, R=1, result in mg CO2eq
    const sciMgCO2eq = carbonOperationalMg + carbonEmbodiedMg;

    return {
        tool: name,
        wallTimeMs: Math.round(wallTimeMs),
        inputSizeBytes: inputBytes,
        outputSizeBytes: measureOutput ? measureOutput(result) : 0,
        heapDeltaBytes: heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null,
        energyKwh,
        carbonOperationalMg,
        carbonEmbodiedMg,
        sciMgCO2eq,
    };
}

// ── Output formatters ───────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function printResult(r: ProfileResult): void {
    const msg = `${r.tool}  ${r.wallTimeMs}ms  ${r.sciMgCO2eq.toFixed(3)} mgCO₂eq  (E=${r.carbonOperationalMg.toFixed(3)}mg + M=${r.carbonEmbodiedMg.toFixed(3)}mg)  in=${formatBytes(r.inputSizeBytes)} out=${formatBytes(r.outputSizeBytes)}`;
    if (_isNode) {
        console.log(`\x1b[32m[SCI]\x1b[0m \x1b[34m${msg}\x1b[0m`);
    } else {
        console.log(`%c[SCI] %c${msg}`, 'color: #22c55e; font-weight: bold', 'color: #3b82f6; font-weight: bold');
    }
}

export function printSummary(results: ProfileResult[]): void {
    const tableData = results.map((r) => ({
        Tool: r.tool,
        'Time (ms)': r.wallTimeMs,
        'Input': formatBytes(r.inputSizeBytes),
        'Output': formatBytes(r.outputSizeBytes),
        'E (mgCO₂)': +r.carbonOperationalMg.toFixed(3),
        'M (mgCO₂)': +r.carbonEmbodiedMg.toFixed(3),
        'SCI (mgCO₂eq)': +r.sciMgCO2eq.toFixed(3),
    }));

    console.table(tableData);

    const totalSci = results.reduce((sum, r) => sum + r.sciMgCO2eq, 0);
    const totalTime = results.reduce((sum, r) => sum + r.wallTimeMs, 0);
    const summaryMsg = `${results.length} tools  |  Total: ${totalSci.toFixed(3)} mgCO₂eq  |  ${totalTime}ms wall time`;
    if (_isNode) {
        console.log(`\x1b[32m[SCI Summary]\x1b[0m \x1b[1m${summaryMsg}\x1b[0m`);
    } else {
        console.log(`%c[SCI Summary] %c${summaryMsg}`, 'color: #22c55e; font-weight: bold', 'color: inherit; font-weight: bold');
    }
}

/**
 * Generate a markdown report table from profiling results.
 */
export function generateMarkdownReport(results: ProfileResult[], meta: { commit: string; machine?: string }): string {
    const lines: string[] = [
        `# SCI Benchmark Report`,
        '',
        `**Date**: ${new Date().toISOString()}`,
        `**Commit**: ${meta.commit}`,
        `**Machine**: ${meta.machine ?? _config.machine}`,
        `**Constants**: E power=${_config.devicePowerW}W, I=${_config.carbonIntensity} gCO₂eq/kWh, M embodied=${_config.embodiedTotalG}g, lifetime=${_config.lifetimeHours}h`,
        `**LCA Source**: ${_config.lcaSource}`,
        '',
        '| Tool | Time (ms) | Input | Output | E (mgCO₂) | M (mgCO₂) | SCI (mgCO₂eq) |',
        '|------|-----------|-------|--------|------------|------------|----------------|',
    ];

    for (const r of results) {
        lines.push(
            `| ${r.tool} | ${r.wallTimeMs} | ${formatBytes(r.inputSizeBytes)} | ${formatBytes(r.outputSizeBytes)} | ${r.carbonOperationalMg.toFixed(3)} | ${r.carbonEmbodiedMg.toFixed(3)} | ${r.sciMgCO2eq.toFixed(3)} |`,
        );
    }

    const totalSci = results.reduce((sum, r) => sum + r.sciMgCO2eq, 0);
    const totalTime = results.reduce((sum, r) => sum + r.wallTimeMs, 0);
    lines.push('', `**Total**: ${totalSci.toFixed(3)} mgCO₂eq across ${results.length} tools in ${totalTime}ms`);

    return lines.join('\n');
}

/**
 * Generate a JSON report entry for appending to sci-history.json.
 * @deprecated Use `toJsonLine()` or `generateJsonLines()` for PHP-compatible format.
 */
export function generateJsonReport(results: ProfileResult[], meta: { commit: string; machine?: string }): object {
    return {
        commit: meta.commit,
        date: new Date().toISOString(),
        machine: meta.machine ?? _config.machine,
        lcaSource: _config.lcaSource,
        constants: {
            devicePowerW: _config.devicePowerW,
            carbonIntensity: _config.carbonIntensity,
            embodiedG: _config.embodiedTotalG,
            lifetimeH: _config.lifetimeHours,
        },
        results: results.map((r) => ({
            service: r.tool,
            wallTimeMs: r.wallTimeMs,
            inputBytes: r.inputSizeBytes,
            outputBytes: r.outputSizeBytes,
            sciMgCO2eq: +r.sciMgCO2eq.toFixed(3),
        })),
        totalSciMg: +results.reduce((sum, r) => sum + r.sciMgCO2eq, 0).toFixed(3),
    };
}

/**
 * Convert a single ProfileResult to a flat JSON object using dot-notation keys,
 * compatible with sci-profiler-php's JSONL format.
 */
export function toJsonLine(result: ProfileResult): JsonLineReport {
    const wallTimeSec = result.wallTimeMs / 1000;
    const sciGco2eq = result.sciMgCO2eq / 1000;
    const opGco2eq = result.carbonOperationalMg / 1000;
    const embGco2eq = result.carbonEmbodiedMg / 1000;

    return {
        'profile_id': generateProfileId(),
        'timestamp': new Date().toISOString(),
        'tool': result.tool,
        'time.wall_time_ms': result.wallTimeMs,
        'time.wall_time_sec': +wallTimeSec.toFixed(6),
        'memory.heap_delta_bytes': result.heapDeltaBytes,
        'io.input_bytes': result.inputSizeBytes,
        'io.output_bytes': result.outputSizeBytes,
        'sci.energy_kwh': result.energyKwh,
        'sci.operational_carbon_gco2eq': +opGco2eq.toFixed(10),
        'sci.embodied_carbon_gco2eq': +embGco2eq.toFixed(10),
        'sci.sci_gco2eq': +sciGco2eq.toFixed(10),
        'sci.sci_mgco2eq': +result.sciMgCO2eq.toFixed(4),
        'config.device_power_w': _config.devicePowerW,
        'config.carbon_intensity': _config.carbonIntensity,
        'config.embodied_total_g': _config.embodiedTotalG,
        'config.lifetime_hours': _config.lifetimeHours,
        'config.machine': _config.machine,
        'config.lca_source': _config.lcaSource,
    };
}

/**
 * Generate JSONL (JSON Lines) output from profiling results.
 * Each result becomes one JSON line, compatible with sci-profiler-php.
 * Pipe through `jq .sci.sci_mgco2eq` to extract SCI scores.
 */
export function generateJsonLines(results: ProfileResult[]): string {
    return results.map((r) => JSON.stringify(toJsonLine(r))).join('\n');
}
