import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import KnownDevice from '../../../src/settings/knownDevice.js';
import { DeviceId } from '../../../src/device/deviceId.js';

describe('KnownDevice', () => {
    it('is enabled by default when constructed without an explicit value', () => {
        const knownDevice = new KnownDevice(DeviceId.create('test'), 'Test Device', 'randomGenerator', 'virtual');

        expect(knownDevice.enabled).toBe(true);
    });

    it('can be constructed as disabled', () => {
        const knownDevice = new KnownDevice(DeviceId.create('test'), 'Test Device', 'randomGenerator', 'virtual', {}, false);

        expect(knownDevice.enabled).toBe(false);
    });

    it('is enabled by default when deserialized from plain JSON without an "enabled" property', () => {
        const knownDevice = plainToInstance(KnownDevice, {
            id: DeviceId.create('test'),
            name: 'Test Device',
            type: 'randomGenerator',
            source: 'virtual',
            config: {},
        });

        expect(knownDevice.enabled).toBe(true);
    });

    it('is disabled when deserialized from plain JSON with "enabled": false', () => {
        const knownDevice = plainToInstance(KnownDevice, {
            id: DeviceId.create('test'),
            name: 'Test Device',
            type: 'randomGenerator',
            source: 'virtual',
            config: {},
            enabled: false,
        });

        expect(knownDevice.enabled).toBe(false);
    });

    it('is enabled when deserialized from plain JSON with "enabled": true', () => {
        const knownDevice = plainToInstance(KnownDevice, {
            id: DeviceId.create('test'),
            name: 'Test Device',
            type: 'randomGenerator',
            source: 'virtual',
            config: {},
            enabled: true,
        });

        expect(knownDevice.enabled).toBe(true);
    });
});
