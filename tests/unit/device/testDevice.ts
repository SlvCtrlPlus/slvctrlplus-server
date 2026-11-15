import { EventEmitter } from "events";
import { mock } from 'vitest-mock-extended';
import { Type } from '@sinclair/typebox';
import Device from "../../../src/device/device.js";
import type { DeviceAttributeValues, DeviceDataApplyError, DeviceDataUpdate } from "../../../src/device/device.js";
import { DeviceId } from '../../../src/device/deviceId.js';
import Logger from '../../../src/logging/Logger.js';
import type JsonSchemaValidatorFactory from '../../../src/schemaValidation/JsonSchemaValidatorFactory.js';
import type JsonSchemaValidator from '../../../src/schemaValidation/JsonSchemaValidator.js';
import type { TSchema } from '@sinclair/typebox';

function createMockValidatorFactory(): JsonSchemaValidatorFactory {
    const mockValidator = mock<JsonSchemaValidator<TSchema>>();
    mockValidator.validate.mockReturnValue(true);
    mockValidator.getValidationErrors.mockReturnValue([]);

    const factory = mock<JsonSchemaValidatorFactory>();
    factory.create.mockReturnValue(mockValidator);

    return factory;
}

export default class TestDevice extends Device
{
    public constructor(
        deviceId: DeviceId,
        deviceName: string,
        connectedSince: Date,
        controllable: boolean,
        eventEmitter: EventEmitter,
    ) {
        const logger = mock<Logger>();
        logger.child.mockReturnValue(mock<Logger>());

        super(
            { deviceId, deviceName, provider: 'dummy', connectedSince, controllable },
            Type.Object({}),
            {},
            createMockValidatorFactory(),
            {},
            eventEmitter,
            logger,
        );
    }

    protected override async applyDeviceData(_update: DeviceDataUpdate<DeviceAttributeValues>): Promise<DeviceDataApplyError[]> {
        throw new Error("Method not implemented.");
    }
}

export const createTestDevice = (): TestDevice => {
    return new TestDevice(DeviceId.create('foo'), 'Foo', new Date(), false, new EventEmitter());
}
