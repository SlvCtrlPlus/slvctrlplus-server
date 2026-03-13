import {describe, it, expect} from "vitest";
import {mock,mockClear} from "vitest-mock-extended";
import DeviceManager, { DeviceManagerEvent } from "../../../src/device/deviceManager.js";
import {EventEmitter} from "events";
import Device from "../../../src/device/device.js";
import TestDevice from "./testDevice.js";
import Logger from "../../../src/logging/Logger.js";

describe('deviceManager', () => {

    it('it adds device to managed devices and emits an event', async () => {

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();
        const mockedLogger = mock<Logger>();

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, new Map<string, Device>(), mockedLogger);

        const device = new TestDevice('foo', 'Foo', new Date(), false, new EventEmitter());

        // New device connected
        expect(deviceManager.getConnectedDevices().length).toBe(0);

        deviceManager.addDevice(device);

        let actualDevices = deviceManager.getConnectedDevices();

        expect(actualDevices.length).toBe(1);
        expect(actualDevices[0]).toBe(device);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledWith(DeviceManagerEvent.deviceConnected, device);
    });


    it('it removes device from managed devices and emits event on disconnect', async () => {

        const connectedDevices = new Map<string, Device>();
        const device = new TestDevice('foo', 'Foo', new Date(), false, new EventEmitter());

        connectedDevices.set(device.getDeviceId, device);

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();
        const mockedLogger = mock<Logger>();

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, connectedDevices, mockedLogger);

        deviceManager.addDevice(device);

        // Connected device refreshed
        device.refresh();

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(2);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(1, DeviceManagerEvent.deviceConnected, device);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(2, DeviceManagerEvent.deviceRefreshed, device);

        mockClear(mockedDeviceManagerEventEmitter);
    });

    it('it emits an event on device update', async () => {

        const connectedDevices = new Map<string, Device>();
        const device = new TestDevice('foo', 'Foo', new Date(), false, new EventEmitter());

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();
        const mockedLogger = mock<Logger>();

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, connectedDevices, mockedLogger);

        deviceManager.addDevice(device);

        // Connected device closed
        device.close();

        expect(deviceManager.getConnectedDevices().length).toBe(0);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(2);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(1, DeviceManagerEvent.deviceConnected, device);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(2, DeviceManagerEvent.deviceDisconnected, device);
    });
});
