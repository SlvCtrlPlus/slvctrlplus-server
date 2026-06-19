import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { AppInstance } from '../../src/app.js';
import { DeviceManagerEvent } from '../../src/device/deviceManager.js';
import Device from '../../src/device/device.js';
import GenericSlvCtrlPlusDevice from '../../src/device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js';
import SlvCtrlPlusSerialDeviceProvider from '../../src/device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js';
import WebSocketEvent from '../../src/device/webSocketEvent.js';
import { SlvCtrlPlusDeviceSimulator } from './helpers/slvCtrlPlusDeviceSimulator.js';
import { createTestApp, teardownTestApp } from './helpers/appHelper.js';
import ServiceMap from '../../src/serviceMap.js';
import { Container } from '@timesplinter/pimple';
import MockSerialPortFactory from './helpers/mockSerialPortFactory.js';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

const V1_PORT_PATH     = '/dev/test-slvctrl-v1-0';
const LEGACY_PORT_PATH = '/dev/test-slvctrl-legacy-0';

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

function waitForNDevicesConnected(container: Container<ServiceMap>, deviceCount: number, timeoutMs = 5000): Promise<Device[]> {
    return new Promise((resolve, reject) => {
        const deviceManager = container.get('device.manager');
        const connected: Device[] = [];

        const timeout = setTimeout(() => {
            deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
            reject(new Error(`Timed out waiting for ${deviceCount} device(s) to connect (>${timeoutMs}ms), got ${connected.length}`));
        }, timeoutMs);

        const listener = (device: Device): void => {
            connected.push(device);
            if (connected.length >= deviceCount) {
                clearTimeout(timeout);
                deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
                resolve(connected);
            }
        };

        deviceManager.on(DeviceManagerEvent.deviceConnected, listener);
    });
}

function waitForDeviceDisconnected(container: Container<ServiceMap>, deviceId: string, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
        const deviceManager = container.get('device.manager');
        const timeout = setTimeout(() => {
            deviceManager.off(DeviceManagerEvent.deviceDisconnected, listener);
            reject(new Error(`Timed out waiting for device ${deviceId} to disconnect (>${timeoutMs}ms)`));
        }, timeoutMs);

        const listener = (device: Device): void => {
            if (device.getDeviceId === deviceId) {
                clearTimeout(timeout);
                deviceManager.off(DeviceManagerEvent.deviceDisconnected, listener);
                resolve();
            }
        };

        deviceManager.on(DeviceManagerEvent.deviceDisconnected, listener);
    });
}

describe('SlvCtrl serial device provider', () => {
    let app: AppInstance;
    let container: Container<ServiceMap>;
    let tmpDir: string;
    let wsEmitSpy: ReturnType<typeof vi.spyOn>;
    let mockSerialPortFactory: MockSerialPortFactory;
    let v1Simulator: SlvCtrlPlusDeviceSimulator;
    let legacySimulator: SlvCtrlPlusDeviceSimulator;

    beforeAll(async () => {
        v1Simulator = new SlvCtrlPlusDeviceSimulator({ protocol: 'v1',  deviceType: 'testDeviceV1' });
        legacySimulator = new SlvCtrlPlusDeviceSimulator({ protocol: 'legacy', deviceType: 'testDeviceLegacy' });

        ({ app, container, tmpDir, mockSerialPortFactory } = await createTestApp(serialSettings));

        mockSerialPortFactory.attachDevice(V1_PORT_PATH, v1Simulator);
        mockSerialPortFactory.attachDevice(LEGACY_PORT_PATH, legacySimulator);
        
        wsEmitSpy = vi.spyOn(app.websocket, 'emit');

        const bothConnected = waitForNDevicesConnected(container, 2);
        await bothConnected;
    });

    afterAll(async () => {
        await teardownTestApp(app, container, tmpDir);
        mockSerialPortFactory.reset();
    });

    it('registers both devices in the device manager', () => {
        const devices = container.get('device.manager').getConnectedDevices();
        expect(devices).toHaveLength(2);
        expect(devices.every(d => d instanceof GenericSlvCtrlPlusDevice)).toBe(true);
    });

    it('exposes both devices via GET /devices', async () => {
        const res = await request(app.instance).get('/devices');
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(2);
        expect(res.body.items.every((item: { provider: string }) =>
            item.provider === SlvCtrlPlusSerialDeviceProvider.providerName
        )).toBe(true);
    });

    it('emits deviceConnected WebSocket event for each device', () => {
        const calls = wsEmitSpy.mock.calls.filter(([event]: [string, ...unknown[]]) => event === WebSocketEvent.deviceConnected);
        expect(calls).toHaveLength(2);
    });

    it('deviceConnected WebSocket event includes serialized device with all attributes', () => {
        const calls = wsEmitSpy.mock.calls.filter(([event]: [string, ...unknown[]]) => event === WebSocketEvent.deviceConnected);
        expect(calls).toHaveLength(2);

        // Find the V1 device event
        const v1DeviceEvent = calls.find(([, payload]: [string, any]) => 
            payload.deviceName?.includes('testDeviceV1') || payload.deviceModel === 'testDeviceV1'
        );
        expect(v1DeviceEvent).toBeDefined();

        const [, v1Payload] = v1DeviceEvent as [string, any];
        expect(v1Payload).toEqual(expect.objectContaining({
            deviceModel: 'testDeviceV1',
            provider: SlvCtrlPlusSerialDeviceProvider.providerName,
            attributes: expect.objectContaining({
                connected: expect.objectContaining({ type: 'bool', modifier: 'ro' }),
                enabled: expect.objectContaining({ type: 'bool', modifier: 'rw' }),
                counter: expect.objectContaining({ type: 'int', modifier: 'ro' }),
                level: expect.objectContaining({ type: 'int', modifier: 'rw' }),
                temperature: expect.objectContaining({ type: 'float', modifier: 'ro' }),
                gain: expect.objectContaining({ type: 'float', modifier: 'rw' }),
                label: expect.objectContaining({ type: 'str', modifier: 'ro' }),
                mode: expect.objectContaining({ type: 'str', modifier: 'rw' }),
                intensity: expect.objectContaining({ type: 'range', modifier: 'rw', min: 0, max: 100 }),
                preset: expect.objectContaining({ type: 'list', modifier: 'rw' }),
                channel: expect.objectContaining({ type: 'list', modifier: 'rw' }),
            })
        }));

        // Find the legacy device event
        const legacyDeviceEvent = calls.find(([, payload]: [string, any]) => 
            payload.deviceName?.includes('testDeviceLegacy') || payload.deviceModel === 'testDeviceLegacy'
        );
        expect(legacyDeviceEvent).toBeDefined();

        const [, legacyPayload] = legacyDeviceEvent as [string, any];
        expect(legacyPayload).toEqual(expect.objectContaining({
            deviceModel: 'testDeviceLegacy',
            provider: SlvCtrlPlusSerialDeviceProvider.providerName,
            attributes: expect.objectContaining({
                connected: expect.objectContaining({ type: 'bool', modifier: 'ro' }),
                enabled: expect.objectContaining({ type: 'bool', modifier: 'rw' }),
                counter: expect.objectContaining({ type: 'int', modifier: 'ro' }),
                level: expect.objectContaining({ type: 'int', modifier: 'rw' }),
                temperature: expect.objectContaining({ type: 'float', modifier: 'ro' }),
                gain: expect.objectContaining({ type: 'float', modifier: 'rw' }),
                label: expect.objectContaining({ type: 'str', modifier: 'ro' }),
                mode: expect.objectContaining({ type: 'str', modifier: 'rw' }),
                intensity: expect.objectContaining({ type: 'range', modifier: 'rw', min: 0, max: 100 }),
                preset: expect.objectContaining({ type: 'list', modifier: 'rw' }),
                channel: expect.objectContaining({ type: 'list', modifier: 'rw' }),
            })
        }));
    });

    function getDevice(model: string): GenericSlvCtrlPlusDevice {
        const devices = container.get('device.manager').getConnectedDevices() as GenericSlvCtrlPlusDevice[];
        const device = devices.find(d => d.getDeviceModel === model);
        if (undefined === device) {
            throw new Error(`Device with model '${model}' not found`);
        }
        return device;
    }

    describe('V1 protocol device', () => {
        it('discovers all attribute types with correct types and modifiers', async () => {
            const device = getDevice('testDeviceV1');
            const res = await request(app.instance).get(`/device/${device.getDeviceId}`);

            expect(res.status).toBe(200);
            const attributes = res.body.attributes;

            expect(attributes.connected).toEqual(expect.objectContaining({ type: 'bool', modifier: 'ro' }));
            expect(attributes.enabled).toEqual(expect.objectContaining({ type: 'bool', modifier: 'rw' }));

            expect(attributes.counter).toEqual(expect.objectContaining({ type: 'int', modifier: 'ro' }));
            expect(attributes.level).toEqual(expect.objectContaining({ type: 'int', modifier: 'rw' }));

            expect(attributes.temperature).toEqual(expect.objectContaining({ type: 'float', modifier: 'ro' }));
            expect(attributes.gain).toEqual(expect.objectContaining({ type: 'float', modifier: 'rw' }));

            expect(attributes.label).toEqual(expect.objectContaining({ type: 'str', modifier: 'ro' }));
            expect(attributes.mode).toEqual(expect.objectContaining({ type: 'str', modifier: 'rw' }));

            expect(attributes.intensity).toEqual(expect.objectContaining({ type: 'range', modifier: 'rw', min: 0, max: 100 }));

            // V1: preset is str list, channel is int list
            expect(attributes.preset).toEqual(expect.objectContaining({ type: 'list', modifier: 'rw' }));
            expect(attributes.channel).toEqual(expect.objectContaining({ type: 'list', modifier: 'rw' }));
        });

        it('updates all attribute values after refresh', async () => {
            const device = getDevice('testDeviceV1');

            v1Simulator.setValue('level', '7');
            v1Simulator.setValue('enabled', '1');
            v1Simulator.setValue('temperature', '98.6');

            await device.refresh();

            expect((await device.getAttribute('level'))?.value).toBe(7);
            expect((await device.getAttribute('enabled'))?.value).toBe(true);
            expect((await device.getAttribute('temperature'))?.value).toBeCloseTo(98.6);
        });

        it('setAttribute sends the correct serial command for each value type', async () => {
            const device = getDevice('testDeviceV1');

            await request(app.instance).patch(`/device/${device.getDeviceId}`).send({ level: 9 }).expect(202);
            expect(v1Simulator.getValue('level')).toBe('9');
            expect((await device.getAttribute('level'))?.value).toBe(9);

            await request(app.instance).patch(`/device/${device.getDeviceId}`).send({ enabled: true }).expect(202);
            expect(v1Simulator.getValue('enabled')).toBe('1');
            expect((await device.getAttribute('enabled'))?.value).toBe(true);

            await request(app.instance).patch(`/device/${device.getDeviceId}`).send({ mode: 'auto' }).expect(202);
            expect(v1Simulator.getValue('mode')).toBe('auto');
            expect((await device.getAttribute('mode'))?.value).toBe('auto');

            await request(app.instance).patch(`/device/${device.getDeviceId}`).send({ intensity: 50 }).expect(202);
            expect(v1Simulator.getValue('intensity')).toBe('50');
            expect((await device.getAttribute('intensity'))?.value).toBe(50);

            await request(app.instance).patch(`/device/${device.getDeviceId}`).send({ preset: 'high' }).expect(202);
            expect(v1Simulator.getValue('preset')).toBe('high');
            expect((await device.getAttribute('preset'))?.value).toBe('high');
        });

        it('updates device attributes via WebSocket events', async () => {
            const device = getDevice('testDeviceV1');
            const testPort = 13371;
            
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Server failed to start')), 2000);
                app.serve(testPort);
                setTimeout(() => {
                    clearTimeout(timeout);
                    resolve();
                }, 100);
            });

            const client = ioClient(`http://localhost:${testPort}`);
            
            try {
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Failed to connect WebSocket client')), 2000);
                    client.on('connect', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                    client.on('connect_error', reject);
                });

                client.emit(WebSocketEvent.deviceUpdateReceived, {
                    deviceId: device.getDeviceId,
                    data: { level: 12 }
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(v1Simulator.getValue('level')).toBe('12');
                expect((await device.getAttribute('level'))?.value).toBe(12);

                client.emit(WebSocketEvent.deviceUpdateReceived, {
                    deviceId: device.getDeviceId,
                    data: { enabled: false }
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(v1Simulator.getValue('enabled')).toBe('0');
                expect((await device.getAttribute('enabled'))?.value).toBe(false);

                client.emit(WebSocketEvent.deviceUpdateReceived, {
                    deviceId: device.getDeviceId,
                    data: { intensity: 75 }
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(v1Simulator.getValue('intensity')).toBe('75');
                expect((await device.getAttribute('intensity'))?.value).toBe(75);
            } finally {
                client.disconnect();
            }
        });
    });

    describe('legacy protocol device', () => {
        it('discovers all attribute types with correct types and modifiers', async () => {
            const device = getDevice('testDeviceLegacy');
            const res = await request(app.instance).get(`/device/${device.getDeviceId}`);

            expect(res.status).toBe(200);
            const attributes = res.body.attributes;

            expect(attributes.connected).toEqual(expect.objectContaining({ type: 'bool', modifier: 'ro' }));
            expect(attributes.enabled).toEqual(expect.objectContaining({ type: 'bool', modifier: 'rw' }));

            expect(attributes.counter).toEqual(expect.objectContaining({ type: 'int', modifier: 'ro' }));
            expect(attributes.level).toEqual(expect.objectContaining({ type: 'int', modifier: 'rw' }));

            expect(attributes.temperature).toEqual(expect.objectContaining({ type: 'float', modifier: 'ro' }));
            expect(attributes.gain).toEqual(expect.objectContaining({ type: 'float', modifier: 'rw' }));

            expect(attributes.label).toEqual(expect.objectContaining({ type: 'str', modifier: 'ro' }));
            expect(attributes.mode).toEqual(expect.objectContaining({ type: 'str', modifier: 'rw' }));

            // Legacy: range is "0-100" syntax
            expect(attributes.intensity).toEqual(expect.objectContaining({ type: 'range', modifier: 'rw', min: 0, max: 100 }));

            // Legacy: lists are plain string values
            expect(attributes.preset).toEqual(expect.objectContaining({ type: 'list', modifier: 'rw' }));
            expect(attributes.channel).toEqual(expect.objectContaining({ type: 'list', modifier: 'rw' }));
        });

        it('updates all attribute values after refresh', async () => {
            const device = getDevice('testDeviceLegacy');

            legacySimulator.setValue('level', '3');
            legacySimulator.setValue('enabled', '1');
            legacySimulator.setValue('temperature', '37.2');

            await device.refresh();

            expect((await device.getAttribute('level'))?.value).toBe(3);
            expect((await device.getAttribute('enabled'))?.value).toBe(true);
            expect((await device.getAttribute('temperature'))?.value).toBeCloseTo(37.2);
        });

        it('setAttribute sends the correct serial command for each value type', async () => {
            const device = getDevice('testDeviceLegacy');

            await request(app.instance).patch(`/device/${device.getDeviceId}`).send({ level: 4 }).expect(202);
            expect(legacySimulator.getValue('level')).toBe('4');
            expect((await device.getAttribute('level'))?.value).toBe(4);

            await request(app.instance).patch(`/device/${device.getDeviceId}`).send({ enabled: true }).expect(202);
            expect(legacySimulator.getValue('enabled')).toBe('1');
            expect((await device.getAttribute('enabled'))?.value).toBe(true);

            await request(app.instance).patch(`/device/${device.getDeviceId}`).send({ mode: 'auto' }).expect(202);
            expect(legacySimulator.getValue('mode')).toBe('auto');
            expect((await device.getAttribute('mode'))?.value).toBe('auto');

            await request(app.instance).patch(`/device/${device.getDeviceId}`).send({ intensity: 25 }).expect(202);
            expect(legacySimulator.getValue('intensity')).toBe('25');
            expect((await device.getAttribute('intensity'))?.value).toBe(25);

            await request(app.instance).patch(`/device/${device.getDeviceId}`).send({ preset: 'medium' }).expect(202);
            expect(legacySimulator.getValue('preset')).toBe('medium');
            expect((await device.getAttribute('preset'))?.value).toBe('medium');
        });

        it('updates device attributes via WebSocket events', async () => {
            const device = getDevice('testDeviceLegacy');
            const testPort = 13372;
            
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Server failed to start')), 2000);
                app.serve(testPort);
                setTimeout(() => {
                    clearTimeout(timeout);
                    resolve();
                }, 100);
            });

            const client = ioClient(`http://localhost:${testPort}`);
            
            try {
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Failed to connect WebSocket client')), 2000);
                    client.on('connect', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                    client.on('connect_error', reject);
                });

                client.emit(WebSocketEvent.deviceUpdateReceived, {
                    deviceId: device.getDeviceId,
                    data: { level: 8 }
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(legacySimulator.getValue('level')).toBe('8');
                expect((await device.getAttribute('level'))?.value).toBe(8);

                client.emit(WebSocketEvent.deviceUpdateReceived, {
                    deviceId: device.getDeviceId,
                    data: { enabled: false }
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(legacySimulator.getValue('enabled')).toBe('0');
                expect((await device.getAttribute('enabled'))?.value).toBe(false);

                client.emit(WebSocketEvent.deviceUpdateReceived, {
                    deviceId: device.getDeviceId,
                    data: { preset: 'high' }
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(legacySimulator.getValue('preset')).toBe('high');
                expect((await device.getAttribute('preset'))?.value).toBe('high');
            } finally {
                client.disconnect();
            }
        });
    });

    describe('Device disconnection', () => {
        let disconnectedV1DeviceId: string;
        let disconnectedLegacyDeviceId: string;

        it('emits deviceDisconnected WebSocket event when device disconnects', async () => {
            const device = getDevice('testDeviceV1');
            disconnectedV1DeviceId = device.getDeviceId;
            
            wsEmitSpy.mockClear();
            
            // Disconnect the device - in production this would happen when hardware is unplugged
            // and SerialPortObserver detects the missing port. MockBinding limitations prevent
            // testing the full port-removal flow, but device.close() triggers the same events.
            const disconnectPromise = waitForDeviceDisconnected(container, disconnectedV1DeviceId);
            await device.close();
            await disconnectPromise;

            const calls = wsEmitSpy.mock.calls.filter(([event]: [string, ...unknown[]]) => event === WebSocketEvent.deviceDisconnected);
            expect(calls).toHaveLength(1);

            const [, payload] = calls[0] as [string, any];
            expect(payload).toEqual(expect.objectContaining({
                deviceId: disconnectedV1DeviceId,
                deviceModel: 'testDeviceV1',
                provider: SlvCtrlPlusSerialDeviceProvider.providerName,
            }));
        });

        it('removes disconnected device from GET /devices', async () => {
            const devicesBeforeRes = await request(app.instance).get('/devices');
            expect(devicesBeforeRes.status).toBe(200);
            const countBefore = devicesBeforeRes.body.count;
            
            const device = getDevice('testDeviceLegacy');
            disconnectedLegacyDeviceId = device.getDeviceId;
            
            const disconnectPromise = waitForDeviceDisconnected(container, disconnectedLegacyDeviceId);
            await device.close();
            await disconnectPromise;

            const devicesAfterRes = await request(app.instance).get('/devices');
            expect(devicesAfterRes.status).toBe(200);
            expect(devicesAfterRes.body.count).toBe(countBefore - 1);
            
            const deviceIds = devicesAfterRes.body.items.map((item: any) => item.deviceId);
            expect(deviceIds).not.toContain(disconnectedLegacyDeviceId);
        });

        it('returns 404 for disconnected device on GET /device/:id', async () => {
            const devices = container.get('device.manager').getConnectedDevices();
            expect(devices).toHaveLength(0);
            
            // Verify both disconnected devices return 404
            const v1Res = await request(app.instance).get(`/device/${disconnectedV1DeviceId}`);
            expect(v1Res.status).toBe(404);

            const legacyRes = await request(app.instance).get(`/device/${disconnectedLegacyDeviceId}`);
            expect(legacyRes.status).toBe(404);
        });
    });
});
