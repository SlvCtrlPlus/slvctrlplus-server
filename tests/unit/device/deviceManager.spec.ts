import {mock, mockClear} from 'jest-mock-extended';
import DeviceManager from "../../../src/device/deviceManager.js";
import {EventEmitter} from "events";
import TestDeviceProvider from "./testDeviceProvider.js";
import DeviceProviderEvent from "../../../src/device/provider/deviceProviderEvent.js";
import Device from "../../../src/device/device.js";
import DeviceManagerEvent from "../../../src/device/deviceManagerEvent.js";

type PartialDevice = Partial<Device>;

describe('deviceManager', () => {

    it('it manages device and emits events on changes of such (connect, refresh and disconnect)', async () => {

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter);
        const testDeviceProviderEventEmitter = new EventEmitter();

        deviceManager.registerDeviceProvider(new TestDeviceProvider(testDeviceProviderEventEmitter));

        const device = {deviceId: 'Foo'} as PartialDevice;

        // New device connected
        expect(deviceManager.getConnectedDevices().length).toBe(0);

        testDeviceProviderEventEmitter.emit(DeviceProviderEvent.deviceConnected, device);

        let actualDevices = deviceManager.getConnectedDevices();

        expect(actualDevices.length).toBe(1);
        expect(actualDevices[0]).toBe(device);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledWith(DeviceManagerEvent.deviceConnected, device);

        mockClear(mockedDeviceManagerEventEmitter);

        // Connected device refreshed
        testDeviceProviderEventEmitter.emit(DeviceProviderEvent.deviceRefreshed, device);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledWith(DeviceManagerEvent.deviceRefreshed, device);

        mockClear(mockedDeviceManagerEventEmitter);

        // Connected device disconnected
        testDeviceProviderEventEmitter.emit(DeviceProviderEvent.deviceDisconnected, device);

        expect(deviceManager.getConnectedDevices().length).toBe(0);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledWith(DeviceManagerEvent.deviceDisconnected, device);
    });
});
