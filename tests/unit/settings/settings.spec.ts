import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { Value } from '@sinclair/typebox/value';
import Settings, { SettingsSchema } from '../../../src/settings/settings.js';
import { DeviceId } from '../../../src/device/deviceId.js';

describe('Settings', () => {
    // Guards the schema-default hydration invariant: legacy/hand-edited settings.json entries
    // missing 'enabled' must still come out enabled after Value.Default + deserialization
    it('defaults a known device missing "enabled" to enabled once hydrated against the schema', () => {
        const plain = {
            knownDevices: {
                [DeviceId.create('test')]: {
                    id: DeviceId.create('test'),
                    name: 'Test Device',
                    type: 'randomGenerator',
                    source: 'virtual',
                    config: {},
                },
            },
            deviceSources: {},
        };

        Value.Default(SettingsSchema, plain);

        const settings = plainToInstance(Settings, plain);

        expect(settings.getKnownDeviceById(DeviceId.create('test'))?.enabled).toBe(true);
    });

    it('defaults a device source missing "enabled" to enabled once hydrated against the schema', () => {
        const plain = {
            knownDevices: {},
            deviceSources: {
                'source-1': {
                    id: 'source-1',
                    type: 'virtual',
                    config: {},
                },
            },
        };

        Value.Default(SettingsSchema, plain);

        const settings = plainToInstance(Settings, plain);

        expect(settings.getDeviceSources().get('source-1')?.enabled).toBe(true);
    });

    it('leaves an explicit "enabled": false untouched when hydrated', () => {
        const plain = {
            knownDevices: {
                [DeviceId.create('test')]: {
                    id: DeviceId.create('test'),
                    name: 'Test Device',
                    type: 'randomGenerator',
                    source: 'virtual',
                    config: {},
                    enabled: false,
                },
            },
            deviceSources: {},
        };

        Value.Default(SettingsSchema, plain);

        const settings = plainToInstance(Settings, plain);

        expect(settings.getKnownDeviceById(DeviceId.create('test'))?.enabled).toBe(false);
    });
});
