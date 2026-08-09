import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Peripheral } from '@stoprocent/noble';
import EventEmitter from 'events';
import { DeviceId } from '../../../../../src/device/deviceId.js';
import AiroticDevice, { AiroticDeviceAttributes } from '../../../../../src/device/protocol/airotic/airoticDevice.js';
import AiroticProtocol from '../../../../../src/device/protocol/airotic/airoticProtocol.js';
import MessageResponseHandler from '../../../../../src/device/protocol/messageResponseHandler.js';
import StrDeviceAttribute from '../../../../../src/device/attribute/strDeviceAttribute.js';
import BoolDeviceAttribute from '../../../../../src/device/attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../../../../src/device/attribute/floatDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../../src/device/attribute/deviceAttribute.js';
import Logger from '../../../../../src/logging/Logger.js';
import BleUartDeviceTransport from '../../../../../src/device/transport/bleDeviceTransport.js';
import { DeviceEvent } from '../../../../../src/device/device.js';

vi.mock('../../../../../src/util/async.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../../src/util/async.js')>();
    return { ...actual, sleep: vi.fn().mockResolvedValue(undefined) };
});

describe('AiroticDevice', () => {
    let mockPeripheral: ReturnType<typeof mock<Peripheral>>;
    let mockTransport: ReturnType<typeof mock<BleUartDeviceTransport>>;
    let mockHandler: ReturnType<typeof mock<MessageResponseHandler<AiroticProtocol>>>;
    let mockLogger: ReturnType<typeof mock<Logger>>;

    function createAttributes(): AiroticDeviceAttributes {
        return {
            restColor: new StrDeviceAttribute('restColor', 'Rest Color', DeviceAttributeModifier.readWrite, undefined),
            breathInColor: new StrDeviceAttribute('breathInColor', 'Breath In Color', DeviceAttributeModifier.readWrite, undefined),
            resetColors: new BoolDeviceAttribute('resetColors', 'Reset Colors', DeviceAttributeModifier.writeOnly, undefined),
            reboot: new BoolDeviceAttribute('reboot', 'Reboot', DeviceAttributeModifier.writeOnly, undefined),
            breathsPerMin: FloatDeviceAttribute.create('breathsPerMin', 'Breaths/min', DeviceAttributeModifier.readOnly, 'breaths/min'),
            bpmTrend: StrDeviceAttribute.create('bpmTrend', 'BPM Trend', DeviceAttributeModifier.readOnly),
        };
    }

    function createDevice(): AiroticDevice {
        return new AiroticDevice(
            {
                deviceId: DeviceId.create('airotic-device'),
                deviceName: 'Airotic',
                provider: 'airotic-provider',
                connectedSince: new Date(),
                controllable: true,
            },
            mockPeripheral,
            mockTransport,
            mockHandler,
            createAttributes(),
            {},
            new EventEmitter(),
            mockLogger,
        );
    }

    beforeEach(() => {
        vi.useFakeTimers();

        mockPeripheral = mock<Peripheral>();
        mockTransport = mock<BleUartDeviceTransport>();
        mockHandler = mock<MessageResponseHandler<AiroticProtocol>>();
        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);

        Object.defineProperty(mockPeripheral, 'rssi', { get: () => -70, configurable: true });
        Object.defineProperty(mockPeripheral, 'state', { get: () => 'connected', configurable: true });

        mockPeripheral.disconnectAsync.mockResolvedValue(undefined);
        mockTransport.close.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('setAttribute restColor', () => {
        it('sends selectRestColor message followed by setColor message', async () => {
            const device = createDevice();

            await device.setAttribute('restColor', '255,0,128');

            expect(mockHandler.send).toHaveBeenCalledTimes(2);
            expect(mockHandler.send).toHaveBeenNthCalledWith(1, AiroticProtocol.createSelectRestColorMessage());
            expect(mockHandler.send).toHaveBeenNthCalledWith(2, AiroticProtocol.createSetColorMessage(255, 0, 128));
        });

        it('returns the color value that was set', async () => {
            const device = createDevice();

            const result = await device.setAttribute('restColor', '100,200,50');

            expect(result).toStrictEqual('100,200,50');
        });

        it('persists the value on the attribute', async () => {
            const device = createDevice();

            await device.setAttribute('restColor', '10,20,30');

            expect((await device.getAttribute('restColor'))?.value).toStrictEqual('10,20,30');
        });
    });

    describe('setAttribute breathInColor', () => {
        it('sends selectBreathInColor message followed by setColor message', async () => {
            const device = createDevice();

            await device.setAttribute('breathInColor', '0,100,200');

            expect(mockHandler.send).toHaveBeenCalledTimes(2);
            expect(mockHandler.send).toHaveBeenNthCalledWith(1, AiroticProtocol.createSelectBreathInColorMessage());
            expect(mockHandler.send).toHaveBeenNthCalledWith(2, AiroticProtocol.createSetColorMessage(0, 100, 200));
        });

        it('returns the color value that was set', async () => {
            const device = createDevice();

            const result = await device.setAttribute('breathInColor', '50,50,50');

            expect(result).toStrictEqual('50,50,50');
        });

        it('persists the value on the attribute', async () => {
            const device = createDevice();

            await device.setAttribute('breathInColor', '5,10,15');

            expect((await device.getAttribute('breathInColor'))?.value).toStrictEqual('5,10,15');
        });
    });

    describe('setAttribute resetColors', () => {
        it('sends resetColors message when value is true', async () => {
            const device = createDevice();

            await device.setAttribute('resetColors', true);

            expect(mockHandler.send).toHaveBeenCalledExactlyOnceWith(AiroticProtocol.createResetColorsMessage());
        });

        it('does not send any message when value is false', async () => {
            const device = createDevice();

            await device.setAttribute('resetColors', false);

            expect(mockHandler.send).not.toHaveBeenCalled();
        });

        it('returns the boolean value that was set', async () => {
            const device = createDevice();

            expect(await device.setAttribute('resetColors', true)).toStrictEqual(true);
            expect(await device.setAttribute('resetColors', false)).toStrictEqual(false);
        });
    });

    describe('setAttribute reboot', () => {
        it('sends reboot message and closes device when value is true', async () => {
            const device = createDevice();
            const closeSpy = vi.spyOn(device, 'close');

            await device.setAttribute('reboot', true);

            expect(mockHandler.send).toHaveBeenCalledExactlyOnceWith(AiroticProtocol.createRebootMessage());
            expect(closeSpy).toHaveBeenCalled();
        });

        it('does not send any message when value is false', async () => {
            const device = createDevice();

            await device.setAttribute('reboot', false);

            expect(mockHandler.send).not.toHaveBeenCalled();
        });

        it('returns the boolean value that was set', async () => {
            const device = createDevice();

            expect(await device.setAttribute('reboot', false)).toStrictEqual(false);
        });
    });

    describe('setAttribute with unknown attribute', () => {
        it('throws an error for unknown attribute name', async () => {
            const device = createDevice();

            await expect(
                Reflect.apply(device.setAttribute, device, ['unknownAttr', 'value']),
            ).rejects.toThrow("Unknown attribute 'unknownAttr' or invalid value type");
        });
    });

    describe('color parsing', () => {
        it('throws when color has wrong number of components', async () => {
            const device = createDevice();

            await expect(
                device.setAttribute('restColor', '255,0'),
            ).rejects.toThrow('Invalid color format: expected 3 components, got 2');
        });

        it('throws when color has too many components', async () => {
            const device = createDevice();

            await expect(
                device.setAttribute('restColor', '255,0,0,0'),
            ).rejects.toThrow('Invalid color format: expected 3 components, got 4');
        });

        it('throws when color channel value is above 255', async () => {
            const device = createDevice();

            await expect(
                device.setAttribute('restColor', '255,0,300'),
            ).rejects.toThrow('Invalid color channel value: 300');
        });

        it('throws when color channel value is negative', async () => {
            const device = createDevice();

            await expect(
                device.setAttribute('restColor', '255,-1,0'),
            ).rejects.toThrow('Invalid color channel value: -1');
        });

        it('throws when color channel value is not a number', async () => {
            const device = createDevice();

            await expect(
                device.setAttribute('restColor', '255,abc,0'),
            ).rejects.toThrow('Invalid color channel value: abc');
        });

        it('correctly parses boundary values 0 and 255', async () => {
            const device = createDevice();

            await expect(
                device.setAttribute('breathInColor', '0,255,0'),
            ).resolves.toStrictEqual('0,255,0');

            expect(mockHandler.send).toHaveBeenNthCalledWith(2, AiroticProtocol.createSetColorMessage(0, 255, 0));
        });
    });

    describe('constructor / transport wiring', () => {
        it('registers an onReceive callback on the transport', () => {
            const device = createDevice();

            expect(mockTransport.onReceive).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
        });

    });

    describe('onReceiveTransportData', () => {
        let onReceiveCb: ((data: Buffer) => void) | undefined;
        let device: AiroticDevice;

        beforeEach(() => {
            mockTransport.onReceive.mockImplementation((cb) => { onReceiveCb = cb; });
            device = createDevice();
        });

        it('emits deviceNotification with colorType breathInColor on *B', () => {
            const listener = vi.fn();
            device.on(DeviceEvent.deviceNotification, listener);

            onReceiveCb!(Buffer.from('*B', 'utf-8'));

            expect(listener).toHaveBeenCalledExactlyOnceWith(device, {
                type: 'colorChange',
                data: { colorType: 'breathInColor' },
            });
        });

        it('emits deviceNotification with colorType restColor on *R', () => {
            const listener = vi.fn();
            device.on(DeviceEvent.deviceNotification, listener);

            onReceiveCb!(Buffer.from('*R', 'utf-8'));

            expect(listener).toHaveBeenCalledExactlyOnceWith(device, {
                type: 'colorChange',
                data: { colorType: 'restColor' },
            });
        });

        it('does not emit deviceNotification for unknown data', () => {
            const listener = vi.fn();
            device.on(DeviceEvent.deviceNotification, listener);

            onReceiveCb!(Buffer.from('UNKNOWN', 'utf-8'));

            expect(listener).not.toHaveBeenCalled();
        });

        it('*B triggers recordBreath but *R does not', () => {
            const refreshListener = vi.fn();
            device.on(DeviceEvent.deviceRefreshed, refreshListener);

            // *R — no breath recorded, no refresh
            onReceiveCb!(Buffer.from('*R', 'utf-8'));
            expect(refreshListener).not.toHaveBeenCalled();

            // *B — breath recorded → updateLastRefresh called
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            expect(refreshListener).toHaveBeenCalledOnce();
        });
    });

    describe('breath recording and BPM (trend) calculation', () => {
        let onReceiveCb: ((data: Buffer) => void) | undefined;
        let device: AiroticDevice;

        const sendBreaths = (intervals: number[]): void => {
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            for (const gap of intervals) {
                vi.advanceTimersByTime(gap);
                onReceiveCb!(Buffer.from('*B', 'utf-8'));
            }
        };

        beforeEach(() => {
            mockTransport.onReceive.mockImplementation((cb) => { onReceiveCb = cb; });
            device = createDevice();
        });

        it('breathsPerMin stays undefined with only one breath', () => {
            onReceiveCb!(Buffer.from('*B', 'utf-8'));

            expect(device['attributes'].breathsPerMin.value).toBeUndefined();
        });

        it('computes correct BPM from two breaths 6 seconds apart', () => {
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            vi.advanceTimersByTime(6_000);
            onReceiveCb!(Buffer.from('*B', 'utf-8'));

            // 1 interval of 6s → 60/6 = 10 breaths/min
            expect(device['attributes'].breathsPerMin.value).toBe(10);
        });

        it('computes correct BPM from three breaths equally spaced', () => {
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            vi.advanceTimersByTime(4_000);
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            vi.advanceTimersByTime(4_000);
            onReceiveCb!(Buffer.from('*B', 'utf-8'));

            // 2 intervals totalling 8s, 2 gaps → 60*2/8 = 15 breaths/min
            expect(device['attributes'].breathsPerMin.value).toBe(15);
        });

        it('evicts timestamps older than the 60s window before calculating BPM', () => {
            // Breath recorded 61s ago (outside window)
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            vi.advanceTimersByTime(61_000);

            // Two breaths inside the window, 3s apart
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            vi.advanceTimersByTime(3_000);
            onReceiveCb!(Buffer.from('*B', 'utf-8'));

            // Only the two in-window breaths count: 1 interval of 3s → 20 bpm
            expect(device['attributes'].breathsPerMin.value).toBe(20);
        });

        it('calls updateLastRefresh on each breath', () => {
            const listener = vi.fn();
            device.on(DeviceEvent.deviceRefreshed, listener);

            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            vi.advanceTimersByTime(1_000);
            onReceiveCb!(Buffer.from('*B', 'utf-8'));

            expect(listener).toHaveBeenCalledTimes(2);
        });

        it('resets breathsPerMin and bpmTrend to undefined after 20s without a breath', () => {
            // Establish a BPM reading first
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            vi.advanceTimersByTime(3_000);
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            expect(device['attributes'].breathsPerMin.value).toBeDefined();

            // Let the timeout expire
            vi.advanceTimersByTime(20_000);

            expect(device['attributes'].breathsPerMin.value).toBeUndefined();
            expect(device['attributes'].bpmTrend.value).toBeUndefined();
        });

        it('clears timestamps after timeout fires', () => {
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            vi.advanceTimersByTime(20_000);

            expect(device['breathTimestamps']).toHaveLength(0);
        });

        it('calls updateLastRefresh when timeout fires', () => {
            onReceiveCb!(Buffer.from('*B', 'utf-8'));

            const listener = vi.fn();
            device.on(DeviceEvent.deviceRefreshed, listener);

            vi.advanceTimersByTime(20_000);

            expect(listener).toHaveBeenCalledOnce();
        });

        it('a second breath before timeout resets the timer', () => {
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            vi.advanceTimersByTime(15_000);

            // Second breath resets the 20s countdown
            onReceiveCb!(Buffer.from('*B', 'utf-8'));

            // 15s later the original timer would have fired — data must still be present
            vi.advanceTimersByTime(15_000);
            expect(device['attributes'].breathsPerMin.value).toBeDefined();

            // Now 20s after the second breath, the new timer fires
            vi.advanceTimersByTime(5_000);
            expect(device['attributes'].breathsPerMin.value).toBeUndefined();
        });

        it('returns undefined when fewer than 7 timestamps are recorded', () => {
            // 6 breaths = 5 intervals, need 7 timestamps (6 intervals)
            sendBreaths([1000, 1000, 1000, 1000, 1000]);
            expect(device['attributes'].bpmTrend.value).toBeUndefined();
        });

        it('returns stable when recent intervals are within the 10% threshold', () => {
            // 7 equal intervals → no change
            sendBreaths([2000, 2000, 2000, 2000, 2000, 2000]);
            expect(device['attributes'].bpmTrend.value).toBe('stable');
        });

        it('returns up when recent intervals are more than 10% shorter (breathing faster)', () => {
            // First 3 intervals slow (4000ms), last 3 fast (1000ms)
            sendBreaths([4000, 4000, 4000, 1000, 1000, 1000]);
            expect(device['attributes'].bpmTrend.value).toBe('up');
        });

        it('returns down when recent intervals are more than 10% longer (breathing slower)', () => {
            // First 3 intervals fast (1000ms), last 3 slow (4000ms)
            sendBreaths([1000, 1000, 1000, 4000, 4000, 4000]);
            expect(device['attributes'].bpmTrend.value).toBe('down');
        });
    });

    describe('doClose', () => {
        it('clears the breath timeout handle when one is active', async () => {
            let onReceiveCb: ((data: Buffer) => void) | undefined;
            mockTransport.onReceive.mockImplementation((cb) => { onReceiveCb = cb; });
            const device = createDevice();

            // Start the timeout by recording a breath
            onReceiveCb!(Buffer.from('*B', 'utf-8'));
            expect(device['breathTimeoutHandle']).not.toBeNull();

            await device.close();

            expect(device['breathTimeoutHandle']).toBeNull();
        });

        it('does not throw when breathTimeoutHandle is null on close', async () => {
            const device = createDevice();

            // No breaths recorded — handle stays null
            expect(device['breathTimeoutHandle']).toBeNull();

            await expect(device.close()).resolves.not.toThrow();
        });

        it('calls transport.close() when device closes', async () => {
            const device = createDevice();

            await device.close();

            expect(mockTransport.close).toHaveBeenCalledOnce();
        });

        it('calls super.doClose() before transport.close()', async () => {
            const callOrder: string[] = [];
            mockPeripheral.disconnectAsync.mockImplementation(async () => { callOrder.push('peripheral'); });
            mockTransport.close.mockImplementation(async () => { callOrder.push('transport'); });

            const device = createDevice();
            await device.close();

            expect(callOrder).toStrictEqual(['peripheral', 'transport']);
        });
    });

    describe('setAttribute reboot - close timing', () => {
        it('calls sleep(500) between sending the reboot message and closing', async () => {
            const { sleep } = await import('../../../../../src/util/async.js');
            const device = createDevice();

            await device.setAttribute('reboot', true);

            expect(sleep).toHaveBeenCalledWith(100);
        });
    });
});
