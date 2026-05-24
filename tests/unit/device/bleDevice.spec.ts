import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Peripheral, PeripheralState } from '@stoprocent/noble';
import EventEmitter from 'events';
import { DeviceId } from '../../../src/device/deviceId.js';
import BleDevice from '../../../src/device/bleDevice.js';
import { AttributeKeyOf, AttributeValueOf, DeviceAttributes } from '../../../src/device/device.js';
import { NoDeviceConfig } from '../../../src/device/deviceConfig.js';
import Logger from '../../../src/logging/Logger.js';
import DeviceState from '../../../src/device/deviceState.js';
import { DeviceEvent } from '../../../src/device/device.js';
import BleUartDeviceTransport from '../../../src/device/transport/bleDeviceTransport.js';

class TestBleDevice extends BleDevice<DeviceAttributes, NoDeviceConfig> {
    public syncStateCalls = 0;

    public constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        peripheral: Peripheral,
        transport: BleUartDeviceTransport,
        connectedSince: Date,
        controllable: boolean,
        attributes: DeviceAttributes,
        config: NoDeviceConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceId, deviceName, provider, peripheral, transport, connectedSince, controllable, attributes, config, eventEmitter, logger);
    }

    public async setAttribute<K extends AttributeKeyOf<DeviceAttributes>>(
        _attributeName: K,
        _value: AttributeValueOf<K>,
    ): Promise<AttributeValueOf<K>> {
        throw new Error('Not implemented');
    }

    protected override async syncState(): Promise<void> {
        this.syncStateCalls++;
    }
}

describe('BleDevice', () => {
    let mockPeripheral: ReturnType<typeof mock<Peripheral>>;
    let mockTransport: ReturnType<typeof mock<BleUartDeviceTransport>>;
    let mockLogger: ReturnType<typeof mock<Logger>>;
    let peripheralState: PeripheralState;

    function createDevice(eventEmitter = new EventEmitter()): TestBleDevice {
        return new TestBleDevice(
            DeviceId.create('test-device'),
            'Test Device',
            'test-provider',
            mockPeripheral,
            mockTransport,
            new Date(),
            true,
            {},
            {},
            eventEmitter,
            mockLogger,
        );
    }

    beforeEach(() => {
        vi.useFakeTimers();

        mockPeripheral = mock<Peripheral>();
        mockTransport = mock<BleUartDeviceTransport>();
        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);

        peripheralState = 'connected';
        Object.defineProperty(mockPeripheral, 'rssi', { get: () => -50, configurable: true });
        Object.defineProperty(mockPeripheral, 'state', { get: () => peripheralState, configurable: true });

        mockPeripheral.disconnectAsync.mockResolvedValue(undefined);
        mockPeripheral.updateRssiAsync.mockResolvedValue(-60);
        mockTransport.close.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('subscribes to disconnect event on peripheral', () => {
            createDevice();

            expect(mockPeripheral.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
        });

        it('registers an onConnected callback on the transport', () => {
            createDevice();

            expect(mockTransport.onConnected).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe('syncState', () => {
        it('calls syncState when the transport fires onConnected', async () => {
            let onConnectedCallback: (() => void) | undefined;
            mockTransport.onConnected.mockImplementation((cb) => { onConnectedCallback = cb; });

            const device = createDevice();

            expect(device.syncStateCalls).toBe(0);

            onConnectedCallback?.();
            await Promise.resolve();

            expect(device.syncStateCalls).toBe(1);
        });
    });

    describe('RSSI update interval', () => {
        it('calls updateRssiAsync after interval fires', async () => {
            createDevice();

            expect(mockPeripheral.updateRssiAsync).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(5000);

            expect(mockPeripheral.updateRssiAsync).toHaveBeenCalled();
        });

        it('skips update when peripheral is disconnected', async () => {
            peripheralState = 'disconnected';
            createDevice();

            await vi.advanceTimersByTimeAsync(5000);

            expect(mockPeripheral.updateRssiAsync).not.toHaveBeenCalled();
        });

        it('handles updateRssiAsync errors gracefully without throwing', async () => {
            mockPeripheral.updateRssiAsync.mockRejectedValue(new Error('BLE stack error'));
            createDevice();

            await expect(vi.advanceTimersByTimeAsync(5000)).resolves.not.toThrow();
            expect(mockLogger.warn).toHaveBeenCalled();
        });
    });

    describe('close', () => {
        it('closes the transport before disconnecting', async () => {
            const device = createDevice();
            const callOrder: string[] = [];
            mockTransport.close.mockImplementation(async () => { callOrder.push('transport'); });
            mockPeripheral.disconnectAsync.mockImplementation(async () => { callOrder.push('peripheral'); });

            await device.close();

            expect(callOrder).toStrictEqual(['transport', 'peripheral']);
        });

        it('disconnects peripheral when state is connected', async () => {
            const device = createDevice();

            await device.close();

            expect(mockPeripheral.disconnectAsync).toHaveBeenCalled();
            expect(mockPeripheral.cancelConnect).not.toHaveBeenCalled();
        });

        it('cancels connect when state is connecting', async () => {
            peripheralState = 'connecting';
            const device = createDevice();

            await device.close();

            expect(mockPeripheral.cancelConnect).toHaveBeenCalled();
            expect(mockPeripheral.disconnectAsync).not.toHaveBeenCalled();
        });

        it('does not disconnect when state is disconnected', async () => {
            peripheralState = 'disconnected';
            const device = createDevice();

            await device.close();

            expect(mockPeripheral.disconnectAsync).not.toHaveBeenCalled();
            expect(mockPeripheral.cancelConnect).not.toHaveBeenCalled();
        });

        it('clears RSSI interval so no more updates are sent', async () => {
            const device = createDevice();

            await device.close();
            await vi.advanceTimersByTimeAsync(15000);

            expect(mockPeripheral.updateRssiAsync).not.toHaveBeenCalled();
        });

        it('removes disconnect listener from peripheral', async () => {
            const device = createDevice();

            await device.close();

            expect(mockPeripheral.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
        });

        it('sets device state to closed', async () => {
            const device = createDevice();

            await device.close();

            expect(device.getState).toStrictEqual(DeviceState.closed);
        });

        it('emits deviceDisconnected event', async () => {
            const eventEmitter = new EventEmitter();
            const device = createDevice(eventEmitter);
            const listener = vi.fn();
            eventEmitter.on(DeviceEvent.deviceDisconnected, listener);

            await device.close();

            expect(listener).toHaveBeenCalledWith(device);
        });

        it('logs a warning and still closes when disconnectAsync throws', async () => {
            mockPeripheral.disconnectAsync.mockRejectedValue(new Error('disconnect failed'));
            const device = createDevice();

            await device.close();

            expect(device.getState).toStrictEqual(DeviceState.closed);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('is a no-op when device is already closed', async () => {
            const device = createDevice();
            await device.close();
            vi.clearAllMocks();

            await device.close();

            expect(mockPeripheral.disconnectAsync).not.toHaveBeenCalled();
            expect(mockPeripheral.cancelConnect).not.toHaveBeenCalled();
        });
    });
});
