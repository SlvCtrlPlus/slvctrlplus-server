import os from 'os';
import process from 'process';
import { EventEmitter } from 'events';
import { OSUtils } from 'node-os-utils';
import { IntervalAsync, setIntervalAsync } from '../util/async.js';
import Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';
import { SerializedHealthMetrics } from './serializedTypes.js';

export enum HealthMetricsCollectorEvent {
    collected = 'healthMetricsCollected',
}

export default class HealthMetricsCollector
{
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
            async () => await this.refresh(),
            { intervalMs, timeoutMs: intervalMs * 3, onError: (err) => logError(this.logger, `Health metrics refresh failed`, err) },
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
                    usage: true === cpuUsage.success ? cpuUsage.data : null,
                    average: true === cpuLoadAvg.success ? cpuLoadAvg.data.load1 : null,
                    cores: true === cpuInfo.success ? cpuInfo.data.cores : null,
                    model: true === cpuInfo.success ? cpuInfo.data.model : null,
                },
                memory: true === memInfo.success ? {
                    totalMemMb: memInfo.data.total.toMB(),
                    usedMemMb: memInfo.data.used.toMB(),
                    freeMemMb: memInfo.data.available.toMB(),
                    usedMemPercentage: memInfo.data.usagePercentage,
                    freeMemPercentage: 100 - memInfo.data.usagePercentage,
                } : null,
                os: {
                    name: os.version(),
                    type: os.type(),
                    arch: os.arch(),
                    platform: os.platform(),
                },
                network: {
                    netstat: true === networkStats.success ? networkStats.data : null,
                },
                ip: true === networkInterfaces.success
                    ? (networkInterfaces.data
                        .find(i => i.internal === false && i.type !== 'loopback' && i.addresses.some(a => a.family === 'IPv4' && a.internal === false))
                        ?.addresses.find(a => a.family === 'IPv4' && a.internal === false)?.address ?? null)
                    : null,
                hostname: os.hostname(),
                uptime: true === sysUptime.success ? Math.floor(sysUptime.data.uptime / 1000) : null,
            }
        };

        this.currentMetrics = metrics;
        this.eventEmitter.emit(HealthMetricsCollectorEvent.collected, metrics);
    }
}
