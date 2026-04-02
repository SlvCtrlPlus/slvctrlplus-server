import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Peripheral } from '@stoprocent/noble';
import EventEmitter from 'events';
import { DeviceId } from '../../../../../src/device/deviceId.js';
import AiroticDevice, { AiroticDeviceAttributes } from '../../../../../src/device/protocol/airotic/airoticDevice.js';
import AiroticProtocol from '../../../../../src/device/protocol/airotic/airtonicProtocol.js';
import MessageResponseHandler from '../../../../../src/device/protocol/messageResponseHandler.js';
import StrDeviceAttribute from '../../../../../src/device/attribute/strDeviceAttribute.js';
import BoolDeviceAttribute from '../../../../../src/device/attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../../src/device/attribute/deviceAttribute.js';
import Logger from '../../../../../src/logging/Logger.js';

vi.mock('../../../../../src/util/async.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../../src/util/async.js')>();
    return { ...actual, sleep: vi.fn().mockResolvedValue(undefined) };
});

describe('AiroticDevice', () => {
    let mockPeripheral: ReturnType<typeof mock<Peripheral>>;
    let mockHandler: ReturnType<typeof mock<MessageResponseHandler<AiroticProtocol>>>;
    let mockLogger: ReturnType<typeof mock<Logger>>;

    function createAttributes(): AiroticDeviceAttributes {
        return {
            restColor: new StrDeviceAttribute('restColor', 'Rest Color', DeviceAttributeModifier.readWrite, undefined),
            breathInColor: new StrDeviceAttribute('breathInColor', 'Breath In Color', DeviceAttributeModifier.readWrite, undefined),
            resetColors: new BoolDeviceAttribute('resetColors', 'Reset Colors', DeviceAttributeModifier.readWrite, undefined),
            reboot: new BoolDeviceAttribute('reboot', 'Reboot', DeviceAttributeModifier.readWrite, undefined),
        };
    }

    function createDevice(): AiroticDevice {
        return new AiroticDevice(
            DeviceId.create('airotic-device'),
            'Airotic',
            'airotic-provider',
            mockPeripheral,
            mockHandler,
            new Date(),
            true,
            createAttributes(),
            {},
            new EventEmitter(),
            mockLogger,
        );
    }

    beforeEach(() => {
        vi.useFakeTimers();

        mockPeripheral = mock<Peripheral>();
        mockHandler = mock<MessageResponseHandler<AiroticProtocol>>();
        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);

        Object.defineProperty(mockPeripheral, 'rssi', { get: () => -70, configurable: true });
        Object.defineProperty(mockPeripheral, 'state', { get: () => 'connected', configurable: true });

        mockPeripheral.disconnectAsync.mockResolvedValue(undefined);
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
    });

    describe('setAttribute resetColors', () => {
        it('sends resetColors message when value is true', async () => {
            const device = createDevice();

            await device.setAttribute('resetColors', true);

            expect(mockHandler.send).toHaveBeenCalledOnce();
            expect(mockHandler.send).toHaveBeenCalledWith(AiroticProtocol.createResetColorsMessage());
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

            expect(mockHandler.send).toHaveBeenCalledOnce();
            expect(mockHandler.send).toHaveBeenCalledWith(AiroticProtocol.createRebootMessage());
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
});
