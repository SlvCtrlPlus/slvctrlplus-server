import {describe, it, expect} from "vitest";
import {mock,mockClear} from "vitest-mock-extended";
import DeviceManager from "../../../src/device/deviceManager.js";
import {EventEmitter} from "events";
import TestDeviceProvider from "./testDeviceProvider.js";
import DeviceProviderEvent from "../../../src/device/provider/deviceProviderEvent.js";
import Device from "../../../src/device/device.js";
import DeviceManagerEvent from "../../../src/device/deviceManagerEvent.js";
import TestDevice from "./testDevice.js";
import Logger from "../../../src/logging/Logger.js";

type PartialDevice = Partial<Device>;

describe('deviceManager', () => {

    it('it adds device to managed devices and emits an event', async () => {

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();
        const mockedLogger = mock<Logger>();

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, new Map<string, Device>());
        const testDeviceProviderEventEmitter = new EventEmitter();

        deviceManager.registerDeviceProvider(new TestDeviceProvider(testDeviceProviderEventEmitter, mockedLogger));

        const device = {deviceId: 'Foo'} as PartialDevice;

        // New device connected
        expect(deviceManager.getConnectedDevices().length).toBe(0);

        testDeviceProviderEventEmitter.emit(DeviceProviderEvent.deviceConnected, device);

        let actualDevices = deviceManager.getConnectedDevices();

        expect(actualDevices.length).toBe(1);
        expect(actualDevices[0]).toBe(device);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledWith(DeviceManagerEvent.deviceConnected, device);
    });


    it('it removes device from managed devices and emits event on disconnect', async () => {

        const connectedDevices = new Map<string, Device>();
        const device = new TestDevice('foo', 'Foo', new Date(), false);

        connectedDevices.set(device.getDeviceId, device);

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();
        const mockedLogger = mock<Logger>();

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, connectedDevices);
        const testDeviceProviderEventEmitter = new EventEmitter();

        deviceManager.registerDeviceProvider(new TestDeviceProvider(testDeviceProviderEventEmitter, mockedLogger));

        // Connected device refreshed
        testDeviceProviderEventEmitter.emit(DeviceProviderEvent.deviceRefreshed, device);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledWith(DeviceManagerEvent.deviceRefreshed, device);

        mockClear(mockedDeviceManagerEventEmitter);
    });

    it('it emits an event on device update', async () => {

        const connectedDevices = new Map<string, Device>();
        const device = new TestDevice('foo', 'Foo', new Date(), false);

        connectedDevices.set(device.getDeviceId, device);

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();
        const mockedLogger = mock<Logger>();

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, connectedDevices);
        const testDeviceProviderEventEmitter = new EventEmitter();

        deviceManager.registerDeviceProvider(new TestDeviceProvider(testDeviceProviderEventEmitter, mockedLogger));

        testDeviceProviderEventEmitter.emit(DeviceProviderEvent.deviceDisconnected, device);

        expect(deviceManager.getConnectedDevices().length).toBe(0);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledWith(DeviceManagerEvent.deviceDisconnected, device);
    });
});
