import ConnectedDeviceRepository from "../../../src/repository/connectedDeviceRepository.js";
import { mock } from "jest-mock-extended";
import DeviceManager from "../../../src/device/deviceManager.js";
import SettingsManager from "../../../src/settings/settingsManager.js";
import PlainToClassSerializer from "../../../src/serialization/plainToClassSerializer.js";
import ClassToPlainSerializer from "../../../src/serialization/classToPlainSerializer.js";
import Logger from "../../../src/logging/Logger.js";

describe('settingsManager', () => {
    it('can be instantiated', async () => {
        const plainToClassSerializerMock = mock<PlainToClassSerializer>();
        const classToPlainSerializerMock = mock<ClassToPlainSerializer>();
        const logger = mock<Logger>();

        const deviceRepository = new SettingsManager(
            'foo',
            plainToClassSerializerMock,
            classToPlainSerializerMock,
            logger
        );
    });
});
