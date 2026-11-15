import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { TSchema } from '@sinclair/typebox';
import { EventEmitter } from 'events';
import VirtualDevice from '../../../../../../src/device/protocol/virtual/virtualDevice.js';
import DisplayVirtualDeviceLogic
    from '../../../../../../src/device/protocol/virtual/display/displayVirtualDeviceLogic.js';
import Logger from '../../../../../../src/logging/Logger.js';
import { DeviceId } from '../../../../../../src/device/deviceId.js';
import type JsonSchemaValidatorFactory from '../../../../../../src/schemaValidation/JsonSchemaValidatorFactory.js';
import type JsonSchemaValidator from '../../../../../../src/schemaValidation/JsonSchemaValidator.js';

function createMockValidatorFactory(): JsonSchemaValidatorFactory {
    const mockValidator = mock<JsonSchemaValidator<TSchema>>();
    mockValidator.validate.mockReturnValue(true);
    mockValidator.getValidationErrors.mockReturnValue([]);
    const factory = mock<JsonSchemaValidatorFactory>();
    factory.create.mockReturnValue(mockValidator);
    return factory;
}

describe('DisplayVirtualDevice', () => {

    function createDevice(): VirtualDevice<DisplayVirtualDeviceLogic> {
        const virtualDeviceLogic = new DisplayVirtualDeviceLogic({});
        return new VirtualDevice(
            {
                deviceId: DeviceId.create('device-id'),
                deviceName: 'device name',
                provider: 'buttplugIo',
                connectedSince: new Date(),
                controllable: true,
            },
            '1.0.0',
            'device model',
            {},
            virtualDeviceLogic,
            createMockValidatorFactory(),
            new EventEmitter(),
            mock<Logger>(),
        );
    }

    it('returns content that has been set', async () => {
        const device = createDevice();

        const content = 'hello world';

        await device.updateDeviceData({ content });

        expect(device.getDeviceData().content).toBe(content);
    });

    it('has a refresh rate of 175ms', async () => {
        const device = createDevice();

        expect(device.getRefreshInterval).toBe(175);
    });
});
