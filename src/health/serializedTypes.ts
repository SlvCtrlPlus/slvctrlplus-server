import { NetworkStats } from 'node-os-utils';

export type SerializedHealthMetrics = {
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
            name: string,
            type: string,
            arch: string,
            platform: string,
        },
        network: {
            netstat: NetworkStats[] | null,
        },
        ip?: string | null,
        hostname: string | null,
        uptime: number | null,
    },
};
