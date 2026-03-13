import { Request, Response } from 'express';
import {describe, it, expect} from "vitest";
import {mock} from "vitest-mock-extended";
import ClassToPlainSerializer from '../../../src/serialization/classToPlainSerializer.js';
import GetDevicesController from "../../../src/controller/getDevicesController.js";
import GenericSlvCtrlPlusDevice from "../../../src/device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js";
import ConnectedDeviceRepository from "../../../src/repository/connectedDeviceRepository.js";
import DeviceTransport from "../../../src/device/transport/deviceTransport.js";
import Logger from '../../../src/logging/Logger.js';
import EventEmitter from 'events';
import TestDevice, { createTestDevice } from '../device/testDevice.js';

describe('getDevicesController', () => {

    it('it returns all connected devices', async () => {

        const transport = mock<DeviceTransport>();
        const logger = mock<Logger>();
        const eventEmitter = mock<EventEmitter>();

        const fwVersion = 10000;
        const deviceUuid = 'foo-bar-baz';
        const deviceName = 'Aston Martin';
        const model = 'et312';
        const protocolVersion = 10000;
        const provider = 'dummy';
        const device = createTestDevice();
        const serializedDevice = {
            fwVersion: fwVersion,
            protocolVersion: protocolVersion,
            deviceId: deviceUuid,
            deviceName: deviceName,
            deviceModel: model,
            provider: provider,
        };
        const responseBody = {
            count: 1,
            items: [
                serializedDevice
            ]
        }

        const mockClassToPlainSerializer = mock<ClassToPlainSerializer>();
        mockClassToPlainSerializer.transform.calledWith(device).mockReturnValue(serializedDevice);

        const mockDeviceRepository = mock<ConnectedDeviceRepository>();
        mockDeviceRepository.getAll.calledWith().mockReturnValue([device]);

        const mockRequest = mock<Request>();

        const mockResponse = mock<Response>();
        mockResponse.status.calledWith(200).mockReturnValue(mockResponse);
        mockResponse.json.calledWith(responseBody).mockReturnValue(mockResponse);

        const controller = new GetDevicesController(
            mockDeviceRepository,
            mockClassToPlainSerializer,
        );

        controller.execute(mockRequest, mockResponse);

        expect(mockDeviceRepository.getAll).toHaveBeenCalledTimes(1);
        expect(mockClassToPlainSerializer.transform).toHaveBeenCalledTimes(1);
    });
});
