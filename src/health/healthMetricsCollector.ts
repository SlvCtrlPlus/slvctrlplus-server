import process from 'process';
import osu from 'node-os-utils';

export type HealthMetrics = { [key: string]: any };

export default class HealthMetricsCollector
{
    public async collect(): Promise<HealthMetrics>
    {
        return {
            process: {
                memoryUsage: process.memoryUsage(),
            },
            system: {
                cpu: {
                    usage: await osu.cpu.usage(100),
                    average: osu.cpu.average(),
                    cores: osu.cpu.count(),
                    model: osu.cpu.model(),
                },
                memory: await osu.mem.info(),
                os: {
                    name: osu.os.oos(),
                    type: osu.os.type(),
                    arch: osu.os.arch(),
                    platform: osu.os.platform(),
                },
                network: {
                    netstat: await osu.netstat.stats()
                },
                ip: osu.os.ip(),
                hostname: osu.os.hostname(),
                uptime: osu.os.uptime(),
            }
        };
    }
}
