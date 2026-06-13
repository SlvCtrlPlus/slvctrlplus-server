import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SerialPortMock } from 'serialport';
import request from 'supertest';
import { AppInstance } from '../../src/app.js';
import { DeviceManagerEvent, SerialDeviceInfo } from '../../src/device/deviceManager.js';
import Device from '../../src/device/device.js';
import GenericSlvCtrlPlusDevice from '../../src/device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js';
import SlvCtrlPlusSerialDeviceProvider from '../../src/device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js';
import WebSocketEvent from '../../src/device/webSocketEvent.js';
import BoolDeviceAttribute from '../../src/device/attribute/boolDeviceAttribute.js';
import IntDeviceAttribute from '../../src/device/attribute/intDeviceAttribute.js';
import FloatDeviceAttribute from '../../src/device/attribute/floatDeviceAttribute.js';
import StrDeviceAttribute from '../../src/device/attribute/strDeviceAttribute.js';
import IntRangeDeviceAttribute from '../../src/device/attribute/intRangeDeviceAttribute.js';
import ListDeviceAttribute from '../../src/device/attribute/listDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../src/util/numbers.js';
import { SlvCtrlPlusDeviceSimulator } from './helpers/slvCtrlPlusDeviceSimulator.js';
import { createTestApp, teardownTestApp } from './helpers/appHelper.js';
import ServiceMap from '../../src/serviceMap.js';
import { Container } from '@timesplinter/pimple';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

const TEST_PORT_PATH = '/dev/test-full-slvctrl-0';
const SERIAL_SOURCE_ID = 'e6f7a8b9-6789-4321-abcd-ef1234567895';

const serialSettings = {
    knownDevices: {},
    deviceSources: {
        [SERIAL_SOURCE_ID]: {
            id: SERIAL_SOURCE_ID,
            type: SlvCtrlPlusSerialDeviceProvider.providerName,
            config: {},
        },
    },
};

function makePortInfo(): SerialDeviceInfo {
    return {
        id: 'SN-TEST-FULL-001',
        portInfo: {
            path: TEST_PORT_PATH,
            manufacturer: 'TestMfg',
            serialNumber: 'SN-TEST-FULL-001',
            pnpId: undefined,
            locationId: undefined,
            vendorId: '1234', // non-Arduino: skips the ReadyParser step
            productId: '5678',
        },
    };
}

function waitForDeviceConnected(container: Container<ServiceMap>, timeoutMs = 5000): Promise<Device> {
    return new Promise((resolve, reject) => {
        const deviceManager = container.get('device.manager');
        const timeout = setTimeout(() => {
            deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
            reject(new Error(`Timed out waiting for device to connect (>${timeoutMs}ms)`));
        }, timeoutMs);

        const listener = (device: Device): void => {
            clearTimeout(timeout);
            deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
            resolve(device);
        };

        deviceManager.on(DeviceManagerEvent.deviceConnected, listener);
    });
}

describe('SlvCtrl serial device provider', () => {
    let app: AppInstance;
    let container: Container<ServiceMap>;
    let tmpDir: string;
    let wsEmitSpy: ReturnType<typeof vi.spyOn>;
    let serialPortSimulator: SlvCtrlPlusDeviceSimulator;

    beforeAll(async () => {
        SerialPortMock.binding.createPort(TEST_PORT_PATH, { echo: false, record: false });

        ({ app, container, tmpDir, serialPortSimulator } = await createTestApp(serialSettings));

        wsEmitSpy = vi.spyOn(app.websocket, 'emit');

        const deviceConnected = waitForDeviceConnected(container);
        container.get('device.manager').announceDetectedDevice(makePortInfo());
        await deviceConnected;
    });

    afterAll(async () => {
        await teardownTestApp(app, container, tmpDir);
        SerialPortMock.binding.reset();
    });

    it('registers the device in the device manager', () => {
        const devices = container.get('device.manager').getConnectedDevices();
        expect(devices).toHaveLength(1);
        expect(devices[0]).toBeInstanceOf(GenericSlvCtrlPlusDevice);
    });

    it('exposes the device via GET /devices', async () => {
        const res = await request(app.instance).get('/devices');
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.items[0]).toEqual(expect.objectContaining({
            provider: SlvCtrlPlusSerialDeviceProvider.providerName,
            type: 'slvCtrlPlus',
        }));
    });

    it('emits deviceConnected WebSocket event when the device connects', () => {
        expect(wsEmitSpy).toHaveBeenCalledWith(
            WebSocketEvent.deviceConnected,
            expect.objectContaining({ provider: SlvCtrlPlusSerialDeviceProvider.providerName }),
        );
    });

    describe('device protocol', () => {
        it('discovers all attribute types with correct types and modifiers', async () => {
            const device = container.get('device.manager').getConnectedDevices()[0] as GenericSlvCtrlPlusDevice;

            expect(await device.getAttribute('connected')).toBeInstanceOf(BoolDeviceAttribute);
            expect((await device.getAttribute('connected'))?.modifier).toBe(DeviceAttributeModifier.readOnly);
            expect(await device.getAttribute('enabled')).toBeInstanceOf(BoolDeviceAttribute);
            expect((await device.getAttribute('enabled'))?.modifier).toBe(DeviceAttributeModifier.readWrite);

            expect(await device.getAttribute('counter')).toBeInstanceOf(IntDeviceAttribute);
            expect((await device.getAttribute('counter'))?.modifier).toBe(DeviceAttributeModifier.readOnly);
            expect(await device.getAttribute('level')).toBeInstanceOf(IntDeviceAttribute);
            expect((await device.getAttribute('level'))?.modifier).toBe(DeviceAttributeModifier.readWrite);

            expect(await device.getAttribute('temperature')).toBeInstanceOf(FloatDeviceAttribute);
            expect((await device.getAttribute('temperature'))?.modifier).toBe(DeviceAttributeModifier.readOnly);
            expect(await device.getAttribute('gain')).toBeInstanceOf(FloatDeviceAttribute);
            expect((await device.getAttribute('gain'))?.modifier).toBe(DeviceAttributeModifier.readWrite);

            expect(await device.getAttribute('label')).toBeInstanceOf(StrDeviceAttribute);
            expect(await device.getAttribute('mode')).toBeInstanceOf(StrDeviceAttribute);

            const intensity = await device.getAttribute('intensity') as IntRangeDeviceAttribute;
            expect(intensity).toBeInstanceOf(IntRangeDeviceAttribute);
            expect(intensity.min).toBe(0);
            expect(intensity.max).toBe(100);

            expect(await device.getAttribute('preset')).toBeInstanceOf(ListDeviceAttribute);
            expect(await device.getAttribute('channel')).toBeInstanceOf(ListDeviceAttribute);
        });

        it('updates all attribute values after refresh', async () => {
            const device = container.get('device.manager').getConnectedDevices()[0] as GenericSlvCtrlPlusDevice;

            serialPortSimulator.setValue('level', '7');
            serialPortSimulator.setValue('enabled', '1');
            serialPortSimulator.setValue('temperature', '98.6');

            await device.refresh();

            expect((await device.getAttribute('level'))?.value).toBe(7);
            expect((await device.getAttribute('enabled'))?.value).toBe(true);
            expect((await device.getAttribute('temperature'))?.value).toBeCloseTo(98.6);
        });

        it('setAttribute sends the correct serial command for each value type', async () => {
            const device = container.get('device.manager').getConnectedDevices()[0] as GenericSlvCtrlPlusDevice;

            expect(await device.setAttribute('level', Int.from(9))).toBe(9);
            expect(serialPortSimulator.getValue('level')).toBe('9');

            expect(await device.setAttribute('enabled', true)).toBe(true);
            expect(serialPortSimulator.getValue('enabled')).toBe('1');

            expect(await device.setAttribute('mode', 'auto')).toBe('auto');
            expect(serialPortSimulator.getValue('mode')).toBe('auto');

            expect(await device.setAttribute('intensity', Int.from(50))).toBe(50);
            expect(serialPortSimulator.getValue('intensity')).toBe('50');

            expect(await device.setAttribute('preset', 'high')).toBe('high');
            expect(serialPortSimulator.getValue('preset')).toBe('high');
        });
    });
});
