import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import KnownDeviceResolver from '../../../src/device/knownDeviceResolver.js';
import Settings from '../../../src/settings/settings.js';
import DeviceNameGenerator from '../../../src/device/deviceNameGenerator.js';
import Logger from '../../../src/logging/Logger.js';
import KnownDevice from '../../../src/settings/knownDevice.js';
import { DeviceId } from '../../../src/device/deviceId.js';

describe('KnownDeviceResolver', () => {
    let mockSettings: ReturnType<typeof mock<Settings>>;
    let mockNameGenerator: ReturnType<typeof mock<DeviceNameGenerator>>;
    let mockLogger: ReturnType<typeof mock<Logger>>;
    let resolver: KnownDeviceResolver;

    beforeEach(() => {
        mockSettings = mock<Settings>();
        mockNameGenerator = mock<DeviceNameGenerator>();
        mockNameGenerator.generateName.mockReturnValue('Generated Name');
        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);

        resolver = new KnownDeviceResolver(mockSettings, mockNameGenerator, mockLogger);
    });

    it('does not persist a new KnownDevice when buildDevice throws', async () => {
        mockSettings.getKnownDeviceById.mockReturnValue(undefined);

        const buildDevice = vi.fn().mockRejectedValue(new Error('handshake failed'));

        await expect(
            resolver.resolveOrCreate(DeviceId.create('device-1'), 'testType', 'testProvider', buildDevice)
        ).rejects.toThrow('handshake failed');

        expect(mockSettings.addKnownDevice).not.toHaveBeenCalled();
    });

    it('persists a new KnownDevice only after buildDevice succeeds', async () => {
        mockSettings.getKnownDeviceById.mockReturnValue(undefined);

        const deviceId = DeviceId.create('device-1');

        const buildDevice = vi.fn().mockImplementation((knownDevice: KnownDevice) => {
            // addKnownDevice must not have been called yet at the point buildDevice runs
            expect(mockSettings.addKnownDevice).not.toHaveBeenCalled();
            return `device-for-${knownDevice.id}`;
        });

        const result = await resolver.resolveOrCreate(deviceId, 'testType', 'testProvider', buildDevice);

        expect(result).toBe(`device-for-${deviceId}`);
        expect(mockSettings.addKnownDevice).toHaveBeenCalledOnce();
        expect(mockSettings.addKnownDevice).toHaveBeenCalledWith(
            expect.objectContaining({ id: deviceId, type: 'testType', source: 'testProvider' }),
        );
    });

    it('uses the provided name over the generated one for a new device', async () => {
        mockSettings.getKnownDeviceById.mockReturnValue(undefined);

        await resolver.resolveOrCreate(
            DeviceId.create('device-1'), 'testType', 'testProvider', () => 'built', 'Explicit Name'
        );

        expect(mockSettings.addKnownDevice).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Explicit Name' }),
        );
        expect(mockNameGenerator.generateName).not.toHaveBeenCalled();
    });

    it('falls back to a generated name when none is provided', async () => {
        mockSettings.getKnownDeviceById.mockReturnValue(undefined);

        await resolver.resolveOrCreate(DeviceId.create('device-1'), 'testType', 'testProvider', () => 'built');

        expect(mockSettings.addKnownDevice).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Generated Name' }),
        );
    });

    it('reuses an already known device without persisting it again', async () => {
        const existingKnownDevice = new KnownDevice(DeviceId.create('device-1'), 'Existing Name', 'testType', 'testProvider');
        mockSettings.getKnownDeviceById.mockReturnValue(existingKnownDevice);

        const buildDevice = vi.fn().mockReturnValue('built-device');

        const result = await resolver.resolveOrCreate(DeviceId.create('device-1'), 'testType', 'testProvider', buildDevice);

        expect(result).toBe('built-device');
        expect(buildDevice).toHaveBeenCalledWith(existingKnownDevice);
        expect(mockSettings.addKnownDevice).not.toHaveBeenCalled();
    });

    it('propagates a buildDevice failure for an already known device without touching settings', async () => {
        const existingKnownDevice = new KnownDevice(DeviceId.create('device-1'), 'Existing Name', 'testType', 'testProvider');
        mockSettings.getKnownDeviceById.mockReturnValue(existingKnownDevice);

        const buildDevice = vi.fn().mockRejectedValue(new Error('boom'));

        await expect(
            resolver.resolveOrCreate(DeviceId.create('device-1'), 'testType', 'testProvider', buildDevice)
        ).rejects.toThrow('boom');

        expect(mockSettings.addKnownDevice).not.toHaveBeenCalled();
    });
});
