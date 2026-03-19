import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    profileTool,
    configureSci,
    resetSciConfig,
    getSciConfig,
    generateJsonReport,
    generateMarkdownReport,
    toJsonLine,
    generateJsonLines,
    printResult,
    printSummary,
    DEFAULT_DEVICE_POWER_W,
    DEFAULT_CARBON_INTENSITY,
    DEFAULT_EMBODIED_TOTAL_G,
    DEFAULT_LIFETIME_HOURS,
    DEFAULT_LCA_SOURCE,
    DEFAULT_MACHINE,
} from '../src/sciProfiler';
import type { ProfileResult, SciConfig, JsonLineReport } from '../src/sciProfiler';

// ── Configuration ────────────────────────────────────────────────────────────

describe('configureSci', () => {
    beforeEach(() => {
        resetSciConfig();
    });

    it('returns defaults before any override', () => {
        const cfg = getSciConfig();
        expect(cfg.devicePowerW).toBe(DEFAULT_DEVICE_POWER_W);
        expect(cfg.carbonIntensity).toBe(DEFAULT_CARBON_INTENSITY);
        expect(cfg.embodiedTotalG).toBe(DEFAULT_EMBODIED_TOTAL_G);
        expect(cfg.lifetimeHours).toBe(DEFAULT_LIFETIME_HOURS);
        expect(cfg.lcaSource).toBe(DEFAULT_LCA_SOURCE);
        expect(cfg.machine).toBe(DEFAULT_MACHINE);
    });

    it('overrides only supplied fields', () => {
        configureSci({ devicePowerW: 10 });
        const cfg = getSciConfig();
        expect(cfg.devicePowerW).toBe(10);
        expect(cfg.carbonIntensity).toBe(DEFAULT_CARBON_INTENSITY);
    });

    it('resetSciConfig restores defaults', () => {
        configureSci({ devicePowerW: 99, carbonIntensity: 1 });
        resetSciConfig();
        const cfg = getSciConfig();
        expect(cfg.devicePowerW).toBe(DEFAULT_DEVICE_POWER_W);
        expect(cfg.carbonIntensity).toBe(DEFAULT_CARBON_INTENSITY);
    });

    it('getSciConfig returns a copy (not a reference)', () => {
        const cfg = getSciConfig();
        cfg.devicePowerW = 999;
        expect(getSciConfig().devicePowerW).toBe(DEFAULT_DEVICE_POWER_W);
    });
});

// ── profileTool ──────────────────────────────────────────────────────────────

describe('profileTool', () => {
    beforeEach(() => {
        resetSciConfig();
    });

    it('returns a ProfileResult with correct tool name', async () => {
        const result = await profileTool('test-op', async () => 42);
        expect(result.tool).toBe('test-op');
    });

    it('measures wall time > 0', async () => {
        const result = await profileTool('delay', async () => {
            const start = Date.now();
            while (Date.now() - start < 10) { /* busy wait */ }
        });
        expect(result.wallTimeMs).toBeGreaterThan(0);
    });

    it('uses provided inputBytes', async () => {
        const result = await profileTool('with-input', async () => null, 1024);
        expect(result.inputSizeBytes).toBe(1024);
    });

    it('defaults inputBytes to 0', async () => {
        const result = await profileTool('no-input', async () => null);
        expect(result.inputSizeBytes).toBe(0);
    });

    it('calls measureOutput callback', async () => {
        const result = await profileTool(
            'measured-output',
            async () => 'hello world',
            0,
            (s) => s.length,
        );
        expect(result.outputSizeBytes).toBe(11);
    });

    it('defaults outputSizeBytes to 0 without measureOutput', async () => {
        const result = await profileTool('no-measure', async () => 'data');
        expect(result.outputSizeBytes).toBe(0);
    });

    it('computes positive energy and carbon values', async () => {
        const result = await profileTool('compute', async () => {
            const start = Date.now();
            while (Date.now() - start < 5) { /* busy wait */ }
        });
        expect(result.energyKwh).toBeGreaterThan(0);
        expect(result.carbonOperationalMg).toBeGreaterThan(0);
        expect(result.carbonEmbodiedMg).toBeGreaterThan(0);
        expect(result.sciMgCO2eq).toBeGreaterThan(0);
    });

    it('SCI = operational + embodied', async () => {
        const result = await profileTool('sci-sum', async () => {
            const start = Date.now();
            while (Date.now() - start < 5) { /* busy wait */ }
        });
        expect(result.sciMgCO2eq).toBeCloseTo(
            result.carbonOperationalMg + result.carbonEmbodiedMg,
            6,
        );
    });
});

// ── SCI Calculation Accuracy ─────────────────────────────────────────────────

describe('SCI calculation with known values', () => {
    beforeEach(() => {
        resetSciConfig();
    });

    it('energy = power × time / 3600000', async () => {
        // With default 18W, 1 second should give 18 / 3600000 = 5e-6 kWh
        configureSci({ devicePowerW: 18 });
        const result = await profileTool('energy-test', async () => {
            const start = Date.now();
            while (Date.now() - start < 100) { /* ~100ms */ }
        });
        const expectedEnergyApprox = (18 * (result.wallTimeMs / 1000)) / 3_600_000;
        expect(result.energyKwh).toBeCloseTo(expectedEnergyApprox, 8);
    });

    it('operational carbon = E × I × 1_000_000', async () => {
        const result = await profileTool('op-carbon', async () => {
            const start = Date.now();
            while (Date.now() - start < 10) { /* busy wait */ }
        });
        const expectedOpCarbon = result.energyKwh * DEFAULT_CARBON_INTENSITY * 1_000_000;
        expect(result.carbonOperationalMg).toBeCloseTo(expectedOpCarbon, 6);
    });

    it('embodied carbon = (embodied / lifetime) × (time / 3600) × 1000', async () => {
        const result = await profileTool('emb-carbon', async () => {
            const start = Date.now();
            while (Date.now() - start < 10) { /* busy wait */ }
        });
        const wallTimeS = result.wallTimeMs / 1000;
        const expectedEmbCarbon = (DEFAULT_EMBODIED_TOTAL_G / DEFAULT_LIFETIME_HOURS) * (wallTimeS / 3600) * 1000;
        expect(result.carbonEmbodiedMg).toBeCloseTo(expectedEmbCarbon, 1);
    });
});

// ── generateJsonReport ───────────────────────────────────────────────────────

describe('generateJsonReport', () => {
    beforeEach(() => {
        resetSciConfig();
    });

    it('includes commit and date', async () => {
        const r = await profileTool('test', async () => null);
        const report = generateJsonReport([r], { commit: 'abc123' }) as any;
        expect(report.commit).toBe('abc123');
        expect(report.date).toBeDefined();
    });

    it('uses config machine as default', async () => {
        const r = await profileTool('test', async () => null);
        const report = generateJsonReport([r], { commit: 'x' }) as any;
        expect(report.machine).toBe(DEFAULT_MACHINE);
    });

    it('allows machine override via meta', async () => {
        const r = await profileTool('test', async () => null);
        const report = generateJsonReport([r], { commit: 'x', machine: 'Custom' }) as any;
        expect(report.machine).toBe('Custom');
    });

    it('results array maps tool to service', async () => {
        const r = await profileTool('my-tool', async () => null);
        const report = generateJsonReport([r], { commit: 'x' }) as any;
        expect(report.results[0].service).toBe('my-tool');
    });

    it('totalSciMg sums all results', async () => {
        const r1 = await profileTool('a', async () => {
            const s = Date.now(); while (Date.now() - s < 5) {}
        });
        const r2 = await profileTool('b', async () => {
            const s = Date.now(); while (Date.now() - s < 5) {}
        });
        const report = generateJsonReport([r1, r2], { commit: 'x' }) as any;
        expect(report.totalSciMg).toBeCloseTo(r1.sciMgCO2eq + r2.sciMgCO2eq, 2);
    });
});

// ── generateMarkdownReport ───────────────────────────────────────────────────

describe('generateMarkdownReport', () => {
    beforeEach(() => {
        resetSciConfig();
    });

    it('starts with header', async () => {
        const r = await profileTool('md-test', async () => null);
        const md = generateMarkdownReport([r], { commit: 'abc' });
        expect(md).toContain('# SCI Benchmark Report');
    });

    it('includes commit', async () => {
        const r = await profileTool('md-test', async () => null);
        const md = generateMarkdownReport([r], { commit: 'abc123' });
        expect(md).toContain('abc123');
    });

    it('includes tool name in table', async () => {
        const r = await profileTool('my-operation', async () => null);
        const md = generateMarkdownReport([r], { commit: 'x' });
        expect(md).toContain('my-operation');
    });

    it('includes total line', async () => {
        const r = await profileTool('t', async () => null);
        const md = generateMarkdownReport([r], { commit: 'x' });
        expect(md).toContain('**Total**:');
    });
});

// ── toJsonLine (PHP-compatible format) ───────────────────────────────────────

describe('toJsonLine', () => {
    beforeEach(() => {
        resetSciConfig();
    });

    it('produces flat dot-notation keys', async () => {
        const r = await profileTool('flat-test', async () => {
            const s = Date.now(); while (Date.now() - s < 5) {}
        });
        const line = toJsonLine(r);

        expect(line.profile_id).toBeDefined();
        expect(line.timestamp).toBeDefined();
        expect(line.tool).toBe('flat-test');
        expect(line['time.wall_time_ms']).toBe(r.wallTimeMs);
        expect(line['time.wall_time_sec']).toBeCloseTo(r.wallTimeMs / 1000, 3);
        expect(line['io.input_bytes']).toBe(r.inputSizeBytes);
        expect(line['io.output_bytes']).toBe(r.outputSizeBytes);
    });

    it('includes SCI fields in gCO2eq and mgCO2eq', async () => {
        const r = await profileTool('sci-fields', async () => {
            const s = Date.now(); while (Date.now() - s < 10) {}
        });
        const line = toJsonLine(r);

        expect(line['sci.energy_kwh']).toBe(r.energyKwh);
        expect(line['sci.sci_mgco2eq']).toBeGreaterThan(0);
        expect(line['sci.sci_gco2eq']).toBeCloseTo(line['sci.sci_mgco2eq'] / 1000, 6);
        expect(line['sci.operational_carbon_gco2eq']).toBeGreaterThan(0);
        expect(line['sci.embodied_carbon_gco2eq']).toBeGreaterThan(0);
    });

    it('includes config snapshot', async () => {
        configureSci({ devicePowerW: 25, machine: 'Test Machine' });
        const r = await profileTool('config-snap', async () => null);
        const line = toJsonLine(r);

        expect(line['config.device_power_w']).toBe(25);
        expect(line['config.machine']).toBe('Test Machine');
        expect(line['config.carbon_intensity']).toBe(DEFAULT_CARBON_INTENSITY);
    });

    it('is valid JSON when stringified', async () => {
        const r = await profileTool('json-valid', async () => null);
        const line = toJsonLine(r);
        const json = JSON.stringify(line);
        const parsed = JSON.parse(json);
        expect(parsed['sci.sci_mgco2eq']).toBe(line['sci.sci_mgco2eq']);
    });
});

// ── generateJsonLines ────────────────────────────────────────────────────────

describe('generateJsonLines', () => {
    beforeEach(() => {
        resetSciConfig();
    });

    it('produces one line per result', async () => {
        const r1 = await profileTool('a', async () => null);
        const r2 = await profileTool('b', async () => null);
        const lines = generateJsonLines([r1, r2]);
        const parts = lines.split('\n');
        expect(parts).toHaveLength(2);
    });

    it('each line is valid JSON', async () => {
        const r = await profileTool('jsonl', async () => null);
        const lines = generateJsonLines([r]);
        const parsed = JSON.parse(lines);
        expect(parsed.tool).toBe('jsonl');
    });

    it('is parseable with jq-like access pattern', async () => {
        const r = await profileTool('jq-test', async () => {
            const s = Date.now(); while (Date.now() - s < 5) {}
        });
        const lines = generateJsonLines([r]);
        const parsed = JSON.parse(lines);
        expect(typeof parsed['sci.sci_mgco2eq']).toBe('number');
        expect(typeof parsed['time.wall_time_ms']).toBe('number');
    });
});

// ── printResult ──────────────────────────────────────────────────────────────

describe('printResult', () => {
    beforeEach(() => {
        resetSciConfig();
    });

    it('logs to console with tool name and SCI score', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const r = await profileTool('print-test', async () => {
            const s = Date.now(); while (Date.now() - s < 5) {}
        });
        printResult(r);
        expect(spy).toHaveBeenCalled();
        const output = spy.mock.calls[0][0] as string;
        expect(output).toContain('print-test');
        expect(output).toContain('mgCO');
        spy.mockRestore();
    });

    it('formats bytes correctly in output', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const r = await profileTool(
            'bytes-test',
            async () => 'x'.repeat(2048),
            512,
            (s) => s.length,
        );
        printResult(r);
        const output = spy.mock.calls[0][0] as string;
        expect(output).toContain('512 B');
        expect(output).toContain('2.0 KB');
        spy.mockRestore();
    });

    it('formats megabytes in output', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const r = await profileTool(
            'mb-test',
            async () => null,
            2 * 1024 * 1024,
        );
        printResult(r);
        const output = spy.mock.calls[0][0] as string;
        expect(output).toContain('2.00 MB');
        spy.mockRestore();
    });
});

// ── printSummary ─────────────────────────────────────────────────────────────

describe('printSummary', () => {
    beforeEach(() => {
        resetSciConfig();
    });

    it('calls console.table and console.log', async () => {
        const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const r1 = await profileTool('sum-a', async () => {
            const s = Date.now(); while (Date.now() - s < 5) {}
        });
        const r2 = await profileTool('sum-b', async () => {
            const s = Date.now(); while (Date.now() - s < 5) {}
        });
        printSummary([r1, r2]);

        expect(tableSpy).toHaveBeenCalledOnce();
        const tableData = tableSpy.mock.calls[0][0] as any[];
        expect(tableData).toHaveLength(2);
        expect(tableData[0].Tool).toBe('sum-a');
        expect(tableData[1].Tool).toBe('sum-b');

        expect(logSpy).toHaveBeenCalled();
        const summaryOutput = logSpy.mock.calls[0][0] as string;
        expect(summaryOutput).toContain('2 tools');
        expect(summaryOutput).toContain('mgCO');

        tableSpy.mockRestore();
        logSpy.mockRestore();
    });
});
