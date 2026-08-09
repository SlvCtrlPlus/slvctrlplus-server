import { beforeEach, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import KnownDeviceRegistry from '../../../src/device/knownDeviceRegistry.js';
import Settings from '../../../src/settings/settings.js';
import DeviceNameGenerator from '../../../src/device/deviceNameGenerator.js';
import Logger from '../../../src/logging/Logger.js';
import KnownDevice from '../../../src/settings/knownDevice.js';
import { DeviceId } from '../../../src/device/deviceId.js';

describe('KnownDeviceRegistry', () => {
    let mockSettings: ReturnType<typeof mock<Settings>>;
    let mockNameGenerator: ReturnType<typeof mock<DeviceNameGenerator>>;
    let mockLogger: ReturnType<typeof mock<Logger>>;
    let registry: KnownDeviceRegistry;

    beforeEach(() => {
        mockSettings = mock<Settings>();
        mockNameGenerator = mock<DeviceNameGenerator>();
        mockNameGenerator.generateName.mockReturnValue('Generated Name');
        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);

        registry = new KnownDeviceRegistry(mockSettings, mockNameGenerator, mockLogger);
    });

    describe('resolve', () => {
        it('returns the already known device without persisting anything', () => {
            const existingKnownDevice = new KnownDevice(DeviceId.create('device-1'), 'Existing Name', 'testType', 'testProvider');
            mockSettings.getKnownDeviceById.mockReturnValue(existingKnownDevice);

            const result = registry.resolve(DeviceId.create('device-1'), 'testType', 'testProvider');

            expect(result).toBe(existingKnownDevice);
            expect(mockSettings.addKnownDevice).not.toHaveBeenCalled();
        });

        it('builds a new, not-yet-persisted KnownDevice when none exists', () => {
            mockSettings.getKnownDeviceById.mockReturnValue(undefined);

            const deviceId = DeviceId.create('device-1');
            const result = registry.resolve(deviceId, 'testType', 'testProvider');

            expect(result).toMatchObject({ id: deviceId, type: 'testType', source: 'testProvider' });
            expect(mockSettings.addKnownDevice).not.toHaveBeenCalled();
        });

        it('uses the provided name over the generated one for a new device', () => {
            mockSettings.getKnownDeviceById.mockReturnValue(undefined);

            const result = registry.resolve(DeviceId.create('device-1'), 'testType', 'testProvider', 'Explicit Name');

            expect(result.name).toBe('Explicit Name');
            expect(mockNameGenerator.generateName).not.toHaveBeenCalled();
        });

        it('falls back to a generated name when none is provided', () => {
            mockSettings.getKnownDeviceById.mockReturnValue(undefined);

            const result = registry.resolve(DeviceId.create('device-1'), 'testType', 'testProvider');

            expect(result.name).toBe('Generated Name');
        });

        it('builds a new identity when the stored device with the same id has a different type', () => {
            const deviceId = DeviceId.create('device-1');
            const existingKnownDevice = new KnownDevice(deviceId, 'Existing Name', 'otherType', 'testProvider');
            mockSettings.getKnownDeviceById.mockReturnValue(existingKnownDevice);

            const result = registry.resolve(deviceId, 'testType', 'testProvider');

            expect(result).not.toBe(existingKnownDevice);
            expect(result).toMatchObject({ id: deviceId, type: 'testType', name: 'Generated Name' });
        });
    });

    describe('persist', () => {
        it('delegates to settings.addKnownDevice for a genuinely new identity', () => {
            const knownDevice = new KnownDevice(DeviceId.create('device-1'), 'Name', 'testType', 'testProvider');
            mockSettings.getKnownDeviceById.mockReturnValue(undefined);

            registry.persist(knownDevice);

            expect(mockSettings.addKnownDevice).toHaveBeenCalledExactlyOnceWith(knownDevice);
        });

        it('does not touch settings when persisting an already-known, unchanged identity', () => {
            const existingKnownDevice = new KnownDevice(DeviceId.create('device-1'), 'Name', 'testType', 'testProvider');
            mockSettings.getKnownDeviceById.mockReturnValue(existingKnownDevice);

            registry.persist(existingKnownDevice);

            expect(mockSettings.addKnownDevice).not.toHaveBeenCalled();
        });

        it('persists when passed a different KnownDevice instance for an already-known id', () => {
            const existingKnownDevice = new KnownDevice(DeviceId.create('device-1'), 'Name', 'testType', 'testProvider');
            const differentInstance = new KnownDevice(DeviceId.create('device-1'), 'Name', 'testType', 'testProvider');
            mockSettings.getKnownDeviceById.mockReturnValue(existingKnownDevice);

            registry.persist(differentInstance);

            expect(mockSettings.addKnownDevice).toHaveBeenCalledWith(differentInstance);
        });
    });

    describe('resolve + persist integration', () => {
        it('does not write to settings when reconnecting an already-known device', () => {
            const existingKnownDevice = new KnownDevice(DeviceId.create('device-1'), 'Existing Name', 'testType', 'testProvider');
            mockSettings.getKnownDeviceById.mockReturnValue(existingKnownDevice);

            const knownDevice = registry.resolve(DeviceId.create('device-1'), 'testType', 'testProvider');
            registry.persist(knownDevice);

            expect(mockSettings.addKnownDevice).not.toHaveBeenCalled();
        });

        it('writes to settings exactly once when connecting a genuinely new device', () => {
            mockSettings.getKnownDeviceById.mockReturnValue(undefined);

            const knownDevice = registry.resolve(DeviceId.create('device-1'), 'testType', 'testProvider');
            registry.persist(knownDevice);

            expect(mockSettings.addKnownDevice).toHaveBeenCalledOnce();
        });
    });
});
