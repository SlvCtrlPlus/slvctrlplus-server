import { ButtplugClientDevice, MessageAttributes, SensorDeviceMessageAttributes, SensorType } from 'buttplug';
import ButtplugIoDevice from '../../../../../src/device/protocol/buttplugIo/buttplugIoDevice.js';
import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { EventEmitter } from 'events';
import { DeviceId } from '../../../../../src/device/deviceId.js';
import Logger from '../../../../../src/logging/Logger.js';
import buttplugIoAttributesSchema from '../../../../../src/device/protocol/buttplugIo/buttplugIoAttributesSchema.js';
import type { ButtplugIoDescriptor } from '../../../../../src/device/protocol/buttplugIo/buttplugIoAttributesSchema.js';
import type { DeviceAttributeValues } from '../../../../../src/device/device.js';
import type { TSchema } from '@sinclair/typebox';
import type JsonSchemaValidatorFactory from '../../../../../src/schemaValidation/JsonSchemaValidatorFactory.js';
import type JsonSchemaValidator from '../../../../../src/schemaValidation/JsonSchemaValidator.js';

function createMockValidatorFactory(): JsonSchemaValidatorFactory {
    const mockValidator = mock<JsonSchemaValidator<TSchema>>();
    mockValidator.validate.mockReturnValue(true);
    mockValidator.getValidationErrors.mockReturnValue([]);
    const factory = mock<JsonSchemaValidatorFactory>();
    factory.create.mockReturnValue(mockValidator);
    return factory;
}

describe('ButtplugIoDevice', () => {

    function createDevice(
        buttplugDeviceMock: ButtplugClientDevice,
        descriptors: ButtplugIoDescriptor[],
        attrs: DeviceAttributeValues,
        stepCounts?: Map<string, number>,
    ): ButtplugIoDevice {
        const schema = buttplugIoAttributesSchema(descriptors);
        return new ButtplugIoDevice(
            {
                deviceId: DeviceId.create('device-id'),
                deviceName: 'device name',
                provider: 'deviceProvider',
                connectedSince: new Date(),
                controllable: true,
            },
            'device model',
            buttplugDeviceMock,
            schema,
            attrs,
            createMockValidatorFactory(),
            stepCounts ?? new Map(),
            new EventEmitter(),
            mock<Logger>(),
        );
    }

    it('updates device data and calls buttplugClientDevice on setting boolean attribute', async () => {
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const descriptors: ButtplugIoDescriptor[] = [
            { key: 'Rotate-1', label: 'Rotate', kind: 'bool' },
        ];
        const attrs: DeviceAttributeValues = { 'Rotate-1': false };

        const device = createDevice(buttplugDeviceMock, descriptors, attrs);

        await device.updateDeviceData({ 'Rotate-1': false });

        expect(device.getDeviceData()['Rotate-1']).toStrictEqual(false);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({ ActuatorType: 'Rotate', Index: 1, Scalar: 0 });
    });

    it('updates device data and calls buttplugClientDevice on setting range attribute', async () => {
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const descriptors: ButtplugIoDescriptor[] = [
            { key: 'Vibrate-2', label: 'Vibrator', kind: 'range', min: 0, max: 20 },
        ];
        const attrs: DeviceAttributeValues = { 'Vibrate-2': 0 };
        const stepCounts = new Map([['Vibrate-2', 20]]);

        const device = createDevice(buttplugDeviceMock, descriptors, attrs, stepCounts);

        const newValue = 5;
        await device.updateDeviceData({ 'Vibrate-2': newValue });

        expect(device.getDeviceData()['Vibrate-2']).toStrictEqual(newValue);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({
            ActuatorType: 'Vibrate',
            Index: 2,
            Scalar: newValue / 20,
        });
    });

    it('updates device data and calls buttplugClientDevice on setting boolean attribute to true', async () => {
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const descriptors: ButtplugIoDescriptor[] = [
            { key: 'Rotate-1', label: 'Rotate', kind: 'bool' },
        ];
        const attrs: DeviceAttributeValues = { 'Rotate-1': false };

        const device = createDevice(buttplugDeviceMock, descriptors, attrs);

        await device.updateDeviceData({ 'Rotate-1': true });

        expect(device.getDeviceData()['Rotate-1']).toStrictEqual(true);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({ ActuatorType: 'Rotate', Index: 1, Scalar: 1 });
    });

    it('updates device data and calls buttplugClientDevice on setting int attribute', async () => {
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const descriptors: ButtplugIoDescriptor[] = [
            { key: 'Oscillate-1', label: 'Oscillate', kind: 'int' },
        ];
        const attrs: DeviceAttributeValues = { 'Oscillate-1': 5 };

        const device = createDevice(buttplugDeviceMock, descriptors, attrs);

        const newValue = 10;
        await device.updateDeviceData({ 'Oscillate-1': newValue });

        expect(device.getDeviceData()['Oscillate-1']).toStrictEqual(newValue);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({ ActuatorType: 'Oscillate', Index: 1, Scalar: newValue });
    });

    it('updates sensor attribute values on refresh', async () => {
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const descriptors: ButtplugIoDescriptor[] = [
            { key: 'Battery-0', label: 'Battery', kind: 'rangeInt', min: 0, max: 100 },
        ];
        const attrs: DeviceAttributeValues = { 'Battery-0': 0 };

        const device = createDevice(buttplugDeviceMock, descriptors, attrs);

        const sensorAttrDef = new SensorDeviceMessageAttributes({ Index: 0 });
        sensorAttrDef.SensorType = SensorType.Battery;
        Object.defineProperty(buttplugDeviceMock, 'messageAttributes', {
            get: () => new MessageAttributes({ SensorReadCmd: [sensorAttrDef] }),
            configurable: true,
        });
        buttplugDeviceMock.sensorRead.mockResolvedValue([85]);

        await device.refresh();

        expect(buttplugDeviceMock.sensorRead).toHaveBeenCalledWith(0, SensorType.Battery);
        expect(device.getDeviceData()['Battery-0']).toStrictEqual(85);
    });

    it('skips sensor refresh when device has no SensorReadCmd', async () => {
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const device = createDevice(buttplugDeviceMock, [], {});

        Object.defineProperty(buttplugDeviceMock, 'messageAttributes', {
            get: () => new MessageAttributes({}),
            configurable: true,
        });

        await device.refresh();

        expect(buttplugDeviceMock.sensorRead).not.toHaveBeenCalled();
    });

    it('reports a refresh interval when the device has sensors', () => {
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const device = createDevice(buttplugDeviceMock, [], {});

        const sensorAttrDef = new SensorDeviceMessageAttributes({ Index: 0 });
        sensorAttrDef.SensorType = SensorType.Battery;
        Object.defineProperty(buttplugDeviceMock, 'messageAttributes', {
            get: () => new MessageAttributes({ SensorReadCmd: [sensorAttrDef] }),
            configurable: true,
        });

        expect(device.getRefreshInterval).toBe(100);
    });

    it('reports no refresh interval when the device has no sensors (actuator-only)', () => {
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const device = createDevice(buttplugDeviceMock, [], {});

        Object.defineProperty(buttplugDeviceMock, 'messageAttributes', {
            get: () => new MessageAttributes({}),
            configurable: true,
        });

        expect(device.getRefreshInterval).toBeUndefined();
    });

    it('reports no refresh interval when SensorReadCmd is an empty array', () => {
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const device = createDevice(buttplugDeviceMock, [], {});

        Object.defineProperty(buttplugDeviceMock, 'messageAttributes', {
            get: () => new MessageAttributes({ SensorReadCmd: [] }),
            configurable: true,
        });

        expect(device.getRefreshInterval).toBeUndefined();
    });
});
