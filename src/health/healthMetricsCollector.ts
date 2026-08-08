import os from 'os';
import process from 'process';
import type { EventEmitter } from 'events';
import { OSUtils } from 'node-os-utils';
import type { IntervalAsync } from '../util/async.js';
import { setIntervalAsync } from '../util/async.js';
import type Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';
import type { SerializedHealthMetrics } from './serializedTypes.js';
import { SECOND_AS_MILLISECONDS } from '../util/numbers.js';

export enum HealthMetricsCollectorEvent {
    collected = 'healthMetricsCollected',
}

export default class HealthMetricsCollector
{
    private static readonly PERCENTAGE_MAX = 100;

    private static readonly COLLECTION_TIMEOUT_MULTIPLIER = 3;

    private readonly osUtils: OSUtils;

    private readonly logger: Logger;

    private readonly eventEmitter: EventEmitter;

    private currentMetrics: SerializedHealthMetrics | null = null;

    private intervalHandle: IntervalAsync | null = null;

    public constructor(logger: Logger, eventEmitter: EventEmitter)
    {
        this.logger = logger;
        this.eventEmitter = eventEmitter;
        this.osUtils = new OSUtils({
            cacheEnabled: true,
            cacheTTL: 60_000,
        });
    }

    public start(intervalMs: number): void
    {
        if (this.intervalHandle !== null) {
            return;
        }

        this.intervalHandle = setIntervalAsync(
            async () => { await this.refresh() },
            {
                intervalMs,
                timeoutMs: intervalMs * HealthMetricsCollector.COLLECTION_TIMEOUT_MULTIPLIER,
                onError: err => logError(this.logger, `Health metrics refresh failed`, err),
            },
        );
    }

    public stop(): void
    {
        this.intervalHandle?.clear();
        this.intervalHandle = null;
        this.eventEmitter.removeAllListeners();
    }

    public on(event: HealthMetricsCollectorEvent, listener: (metrics: SerializedHealthMetrics) => void): this
    {
        this.eventEmitter.on(event, listener);
        return this;
    }

    public collect(): SerializedHealthMetrics | null
    {
        return this.currentMetrics;
    }

    private async refresh(): Promise<void>
    {
        const [cpuUsage, cpuInfo, cpuLoadAvg, memInfo, sysUptime, networkStats, networkInterfaces] = await Promise.all([
            this.osUtils.cpu.usage(),
            this.osUtils.cpu.info(),
            this.osUtils.cpu.loadAverage(),
            this.osUtils.memory.info(),
            this.osUtils.system.uptime(),
            this.osUtils.network.statsAsync(),
            this.osUtils.network.interfaces(),
        ]);

        const metrics: SerializedHealthMetrics = {
            process: {
                memoryUsage: process.memoryUsage(),
            },
            system: {
                cpu: {
                    usage: cpuUsage.success ? cpuUsage.data : null,
                    average: cpuLoadAvg.success ? cpuLoadAvg.data.load1 : null,
                    cores: cpuInfo.success ? cpuInfo.data.cores : null,
                    model: cpuInfo.success ? cpuInfo.data.model : null,
                },
                memory: memInfo.success
                    ? {
                        totalMemMb: memInfo.data.total.toMB(),
                        usedMemMb: memInfo.data.used.toMB(),
                        freeMemMb: memInfo.data.available.toMB(),
                        usedMemPercentage: memInfo.data.usagePercentage,
                        freeMemPercentage: HealthMetricsCollector.PERCENTAGE_MAX - memInfo.data.usagePercentage,
                    }
                    : null,
                os: {
                    name: os.version(),
                    type: os.type(),
                    arch: os.arch(),
                    platform: os.platform(),
                },
                network: {
                    netstat: networkStats.success ? networkStats.data : null,
                },
                ip: networkInterfaces.success
                    ? (networkInterfaces.data
                        .find(i => !i.internal && i.type !== 'loopback' && i.addresses.some(a => a.family === 'IPv4' && !a.internal))
                        ?.addresses.find(a => a.family === 'IPv4' && !a.internal)?.address ?? null)
                    : null,
                hostname: os.hostname(),
                uptime: sysUptime.success ? Math.floor(sysUptime.data.uptime / SECOND_AS_MILLISECONDS) : null,
            },
        };

        this.currentMetrics = metrics;
        this.eventEmitter.emit(HealthMetricsCollectorEvent.collected, metrics);
    }
}
