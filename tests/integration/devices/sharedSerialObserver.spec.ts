import { afterAll, assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import SlvCtrlPlusSerialDeviceProvider from '../../../src/device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js';
import Zc95SerialDeviceProvider from '../../../src/device/protocol/zc95/zc95SerialDeviceProvider.js';
import EStim2bSerialDeviceProvider from '../../../src/device/protocol/estim2b/estim2bSerialDeviceProvider.js';
import WebSocketEvent from '../../../src/device/webSocketEvent.js';
import { SlvCtrlPlusDeviceSimulator } from '../helpers/slvCtrlPlusDeviceSimulator.js';
import { createTestApp, teardownTestApp, waitForNextWsEvent, createWsClient, TestApp } from '../helpers/appHelper.js';
import Settings from '../../../src/settings/settings.js';
import DeviceSource from '../../../src/settings/deviceSource.js';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

const V1_PORT_PATH = '/dev/test-slvctrl-v1-0';

const SERIAL_SOURCE_ID = 'e6f7a8b9-6789-4321-abcd-ef1234567895';

// All three serial-protocol providers share the same SerialPortObserver singleton (they all
// watch the same physical ports and race to claim any detected device - see
// DeviceServiceProvider, where all three factories are wired to the same 'device.observer.serial'
// instance). This file exercises that shared-observer behavior specifically - it uses
// SlvCtrlPlusDeviceSimulator as a concrete stand-in device only because it's the most complete
// simulator available; the scenarios below are about the provider-manager/observer lifecycle,
// not SlvCtrl+ protocol semantics (those are covered in slvCtrlSerialDevice.spec.ts).
const ZC95_SOURCE_ID = 'a1c2d3e4-1234-4321-abcd-ef1234567896';
const ESTIM2B_SOURCE_ID = 'b2d3e4f5-2345-4321-abcd-ef1234567897';

const serialSettings = {
    knownDevices: {},
    deviceSources: {
        // SlvCtrl+ listed first so it deterministically wins the claim race for the mock device
        // used throughout this file (see DeviceManager.acquireDetectedDevice()'s FCFS queue).
        [SERIAL_SOURCE_ID]: {
            id: SERIAL_SOURCE_ID,
            type: SlvCtrlPlusSerialDeviceProvider.providerName,
            config: {},
        },
        [ZC95_SOURCE_ID]: {
            id: ZC95_SOURCE_ID,
            type: Zc95SerialDeviceProvider.providerName,
            config: {},
        },
        [ESTIM2B_SOURCE_ID]: {
            id: ESTIM2B_SOURCE_ID,
            type: EStim2bSerialDeviceProvider.providerName,
            config: {},
        },
    },
};

describe('Serial protocol providers sharing one SerialPortObserver', () => {
    let app: TestApp;
    let wsEmitSpy: ReturnType<typeof vi.spyOn>;
    let wsClient: ReturnType<typeof ioClient>;

    beforeAll(async () => {
        app = await createTestApp(serialSettings);

        wsEmitSpy = vi.spyOn(app.websocket, 'emit');

        wsClient = await createWsClient(app.httpServer);
    });

    afterAll(async () => {
        wsClient.disconnect();
        await teardownTestApp(app);
        app.mockSerialPortFactory.reset();
    });

    beforeEach(async () => {
        // Close all connected devices before destroying the mock binding so their polling
        // timers are stopped and the device-close chain completes cleanly. Without this,
        // stale devices accumulate across test iterations: each one keeps a 100ms polling
        // timer alive and floods the event loop with I/O errors after the binding is torn down.
        await app.container.get('device.manager').reset();
        app.mockSerialPortFactory.reset();
        await app.container.get('device.observer.serial').discoverSerialDevices();
        wsEmitSpy.mockClear();
    });

    it('emits deviceDisconnected only once per close(), not once per underlying stream', async () => {
        // close() destroys the writer/reader after releasing the port, which triggers their own
        // 'close' events - without a guard against that self-triggered re-entry, the device's
        // close chain (and thus this WS event) would fire a second time for the same close().
        const simulator = new SlvCtrlPlusDeviceSimulator({ protocol: 'v1', deviceType: 'testDeviceV1' });
        app.mockSerialPortFactory.attachDevice(V1_PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await app.container.get('device.observer.serial').discoverSerialDevices();
        const [payload] = await deviceConnected;

        const device = app.container.get('device.manager').getConnectedDevice(payload.deviceId);
        assert(device !== null);

        wsEmitSpy.mockClear();

        const deviceDisconnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceDisconnected);
        await device.close();
        await deviceDisconnected;

        // Give any stray re-entrant close/emit a chance to fire before counting
        await new Promise((resolve) => setTimeout(resolve, 200));

        const disconnectCalls = wsEmitSpy.mock.calls.filter((call: unknown[]) => call[0] === WebSocketEvent.deviceDisconnected);
        expect(disconnectCalls.length).toBe(1);
    });

    it('reconnects a device after its source is disabled then re-enabled, even while other sources keep the observer alive', async () => {
        const simulator = new SlvCtrlPlusDeviceSimulator({ protocol: 'v1', deviceType: 'testDeviceV1' });
        app.mockSerialPortFactory.attachDevice(V1_PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await app.container.get('device.observer.serial').discoverSerialDevices();
        await deviceConnected;

        expect(app.container.get('device.manager').getConnectedDevices().length).toBe(1);

        const settingsManager = app.container.get('settings.manager');

        // Disable only the SlvCtrl+ source: the connected device must close and disappear. zc95
        // and estim2b stay enabled - they share the same SerialPortObserver, so this exercises
        // the case where the observer stays alive (kept running by the other two sources)
        // instead of fully stopping.
        const disabledSettings = new Settings();
        disabledSettings.addDeviceSource(new DeviceSource(SERIAL_SOURCE_ID, SlvCtrlPlusSerialDeviceProvider.providerName, {}, false));
        disabledSettings.addDeviceSource(new DeviceSource(ZC95_SOURCE_ID, Zc95SerialDeviceProvider.providerName, {}, true));
        disabledSettings.addDeviceSource(new DeviceSource(ESTIM2B_SOURCE_ID, EStim2bSerialDeviceProvider.providerName, {}, true));

        const deviceDisconnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceDisconnected);
        settingsManager.replace(disabledSettings);
        await deviceDisconnected;

        expect(app.container.get('device.manager').getConnectedDevices().length).toBe(0);

        // Re-enable the SlvCtrl+ source: the still-plugged-in device must reconnect on its own,
        // even though the observer never fully stopped in between (zc95/estim2b kept it alive).
        const reenabledSettings = new Settings();
        reenabledSettings.addDeviceSource(new DeviceSource(SERIAL_SOURCE_ID, SlvCtrlPlusSerialDeviceProvider.providerName, {}, true));
        reenabledSettings.addDeviceSource(new DeviceSource(ZC95_SOURCE_ID, Zc95SerialDeviceProvider.providerName, {}, true));
        reenabledSettings.addDeviceSource(new DeviceSource(ESTIM2B_SOURCE_ID, EStim2bSerialDeviceProvider.providerName, {}, true));

        const deviceReconnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        settingsManager.replace(reenabledSettings);
        await deviceReconnected;

        expect(app.container.get('device.manager').getConnectedDevices().length).toBe(1);
    });
});
