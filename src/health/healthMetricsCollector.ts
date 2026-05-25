import os from 'os';
import process from 'process';
import { NetworkStats, OSUtils } from 'node-os-utils';

export type HealthMetrics = {
    process: {
        memoryUsage: NodeJS.MemoryUsage,
    },
    system: {
        cpu: {
            usage: number | null,
            average: number | null,
            cores: number | null,
            model: string | null,
        },
        memory: {
            totalMemMb: number;
            usedMemMb: number;
            freeMemMb: number;
            usedMemPercentage: number;
            freeMemPercentage: number;
        } | null,
        os: {
            name: string | null,
            type: string | null,
            arch: string | null,
            platform: string | null,
        },
        network: {
            netstat: NetworkStats[] | null,
        },
        ip?: string | null,
        hostname: string | null,
        uptime: number | null,
    },
};

export default class HealthMetricsCollector
{
    private readonly osUtils: OSUtils;

    public constructor()
    {
        this.osUtils = new OSUtils({
            cacheEnabled: true,
            cacheTTL: 60_000,
        });
    }

    public async collect(): Promise<HealthMetrics>
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

        return {
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
    }
}
