import {describe, it, expect, beforeEach} from "vitest";
import {mock,mockClear} from "vitest-mock-extended";
import DeviceManager, { DeviceManagerEvent } from "../../../src/device/deviceManager.js";
import {EventEmitter} from "events";
import Device from "../../../src/device/device.js";
import TestDevice from "./testDevice.js";
import Logger from "../../../src/logging/Logger.js";
import { DeviceId } from "../../../src/device/deviceId.js";

describe('deviceManager', () => {

    it('it adds device to managed devices and emits an event', async () => {

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();

        const mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, new Map<string, Device>(), mockedLogger);

        const device = new TestDevice(DeviceId.create('test-device-id'), 'Foo', new Date(), false, new EventEmitter());

        // New device connected
        expect(deviceManager.getConnectedDevices().length).toBe(0);

        deviceManager.addDevice(device);

        let actualDevices = deviceManager.getConnectedDevices();

        expect(actualDevices.length).toBe(1);
        expect(actualDevices[0]).toBe(device);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledWith(DeviceManagerEvent.deviceConnected, device);
        expect(mockedLogger.child).toBeCalledWith({ name: DeviceManager.name });
    });


    it('it removes device from managed devices and emits event on disconnect', async () => {

        const connectedDevices = new Map<string, Device>();
        const device = new TestDevice(DeviceId.create('test-device-id'), 'Foo', new Date(), false, new EventEmitter());

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();

        const mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, connectedDevices, mockedLogger);

        deviceManager.addDevice(device);

        // Connected device refreshed
        await device.refresh();

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(2);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(1, DeviceManagerEvent.deviceConnected, device);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(2, DeviceManagerEvent.deviceRefreshed, device);
        expect(mockedLogger.child).toBeCalledWith({ name: DeviceManager.name });

        mockClear(mockedDeviceManagerEventEmitter);
    });

    it('it emits an event on device update', async () => {

        const connectedDevices = new Map<string, Device>();
        const device = new TestDevice(DeviceId.create('test-device-id'), 'Foo', new Date(), false, new EventEmitter());

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();

        const mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, connectedDevices, mockedLogger);

        deviceManager.addDevice(device);

        // Connected device closed
        await device.close();

        expect(deviceManager.getConnectedDevices().length).toBe(0);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(2);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(1, DeviceManagerEvent.deviceConnected, device);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(2, DeviceManagerEvent.deviceDisconnected, device);
        expect(mockedLogger.child).toBeCalledWith({ name: DeviceManager.name });
    });

    describe('getConnectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
        });

        it('returns the device when found by uuid', () => {
            const uuid = 'known-device-uuid';
            const device = mock<Device>();
            const connectedDevices = new Map<string, Device>([[uuid, device]]);
            const manager = new DeviceManager(mock<EventEmitter>(), connectedDevices, mockedLogger);

            expect(manager.getConnectedDevice(uuid)).toBe(device);
        });

        it('returns null when device is not found', () => {
            const manager = new DeviceManager(mock<EventEmitter>(), new Map(), mockedLogger);

            expect(manager.getConnectedDevice('unknown-uuid')).toBeNull();
        });
    });
});
