import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import DeviceSource from '../../../src/settings/deviceSource.js';

describe('DeviceSource', () => {
    it('is enabled by default when constructed without an explicit value', () => {
        const deviceSource = new DeviceSource('test-id', 'virtual', {});

        expect(deviceSource.enabled).toBe(true);
    });

    it('can be constructed as disabled', () => {
        const deviceSource = new DeviceSource('test-id', 'virtual', {}, false);

        expect(deviceSource.enabled).toBe(false);
    });

    it('is disabled when deserialized from plain JSON with "enabled": false', () => {
        const deviceSource = plainToInstance(DeviceSource, {
            id: 'test-id',
            type: 'virtual',
            config: {},
            enabled: false,
        });

        expect(deviceSource.enabled).toBe(false);
    });

    it('is enabled when deserialized from plain JSON with "enabled": true', () => {
        const deviceSource = plainToInstance(DeviceSource, {
            id: 'test-id',
            type: 'virtual',
            config: {},
            enabled: true,
        });

        expect(deviceSource.enabled).toBe(true);
    });
});
