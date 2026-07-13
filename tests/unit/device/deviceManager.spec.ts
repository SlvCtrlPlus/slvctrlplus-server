import {describe, it, expect, beforeEach} from "vitest";
import {mock,mockClear} from "vitest-mock-extended";
import DeviceManager, { DeviceManagerEvent, DeviceInfo } from "../../../src/device/deviceManager.js";
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

    describe('announceDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-1');
        const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
        });

        it('emits deviceDetected event for a newly seen device', () => {
            mockedEventEmitter.emit.mockReturnValue(true);
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
        });

        it('does not re-announce a device already in the acquire queue', () => {
            mockedEventEmitter.emit.mockReturnValue(true);
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedLogger);

            manager.announceDetectedDevice(deviceInfo);
            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).toHaveBeenCalledOnce();
            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
        });

        it('does not emit event when device is already connected', () => {
            const connectedDevices = new Map<string, Device>([[deviceId, mock<Device>()]]);
            const manager = new DeviceManager(mockedEventEmitter, connectedDevices, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('removes device from queue when no listeners respond to deviceDetected', async () => {
            mockedEventEmitter.emit.mockReturnValue(false);
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            const result = await manager.acquireDetectedDevice(deviceId);
            expect(result.successful).toBe(false);
        });
    });

    describe('acquireDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-2');
        const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('returns failure when device is not in the detect queue', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedLogger);

            const result = await manager.acquireDetectedDevice(deviceId);

            expect(result.successful).toBe(false);
        });

        it('resolves immediately with success for the first caller', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            const result = await manager.acquireDetectedDevice(deviceId);

            expect(result).toStrictEqual({ successful: true });
        });

        it('queues the second caller until the first releases', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            await manager.acquireDetectedDevice(deviceId);
            const secondCallerPromise = manager.acquireDetectedDevice(deviceId);
            manager.releaseDetectedDevice(deviceId);

            const result = await secondCallerPromise;
            expect(result).toStrictEqual({ successful: true });
        });
    });

    describe('releaseDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-3');
        const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('is a no-op when device is not in the acquire queue', () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedLogger);

            expect(() => manager.releaseDetectedDevice(DeviceId.create('unknown'))).not.toThrow();
        });

        it('removes device from queue after the only waiter releases', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedLogger);
            manager.announceDetectedDevice(deviceInfo);
            await manager.acquireDetectedDevice(deviceId);

            manager.releaseDetectedDevice(deviceId);

            const result = await manager.acquireDetectedDevice(deviceId);
            expect(result.successful).toBe(false);
        });
    });

    describe('revokeDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-4');
        const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('resolves a pending second caller with failure', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedLogger);
            manager.announceDetectedDevice(deviceInfo);
            await manager.acquireDetectedDevice(deviceId); // first caller holds
            const pendingPromise = manager.acquireDetectedDevice(deviceId); // second waits

            manager.revokeDetectedDevice(deviceInfo);

            const result = await pendingPromise;
            expect(result.successful).toBe(false);
        });
    });

    describe('claimDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-5');
        const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('resolves a pending caller with failure', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedLogger);
            manager.announceDetectedDevice(deviceInfo);
            await manager.acquireDetectedDevice(deviceId); // first caller holds
            const pendingPromise = manager.acquireDetectedDevice(deviceId); // second waits

            manager.claimDetectedDevice(deviceId);

            const result = await pendingPromise;
            expect(result.successful).toBe(false);
        });
    });
});
