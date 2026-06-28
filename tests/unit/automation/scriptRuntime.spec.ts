import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { EventEmitter } from 'events';
import { tmpdir } from 'os';
import ScriptRuntime, { SupportedDeviceEvent } from '../../../src/automation/scriptRuntime.js';
import AutomationEventType from '../../../src/automation/automationEventType.js';
import { DeviceManagerEvent } from '../../../src/device/deviceManager.js';
import Device, { AttributeKeyOf, AttributeValueOf, DeviceAttributes } from '../../../src/device/device.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import DeviceRepositoryInterface from '../../../src/repository/deviceRepositoryInterface.js';
import StrDeviceAttribute from '../../../src/device/attribute/strDeviceAttribute.js';
import Logger from '../../../src/logging/Logger.js';
import { DeviceId } from '../../../src/device/deviceId.js';

// ---------------------------------------------------------------------------
// Stub device with a single 'label' string attribute
// ---------------------------------------------------------------------------

class StubDevice extends Device {
    public readonly setAttributeCalls: Array<[string, unknown]> = [];

    public constructor(id: DeviceId, name: string) {
        super(
            id, name, 'test', new Date(), true,
            {
                label: StrDeviceAttribute.createInitialized(
                    'label', undefined, DeviceAttributeModifier.readWrite, 'hello'
                ),
            },
            {}, new EventEmitter(),
        );
    }

    public async setAttribute<
        K extends AttributeKeyOf<DeviceAttributes>
    >(attributeName: K, value: AttributeValueOf<K>): Promise<AttributeValueOf<K>> {
        this.setAttributeCalls.push([attributeName, value]);
        return Promise.resolve(value);
    }
}

// ---------------------------------------------------------------------------
// Stub repository
// ---------------------------------------------------------------------------

class StubRepo implements DeviceRepositoryInterface {
    private readonly _devices: StubDevice[];

    public constructor(devices: StubDevice[]) {
        this._devices = devices;
    }

    public getAll(): Device[] {
        return this._devices;
    }

    public getById(id: string): Device | null {
        return this._devices.find(d => d.getDeviceId === id) ?? null;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Dispatch an event into the runtime and collect console.log lines until the
 * given `marker` string appears (the script must emit it last).
 */
function dispatchAndCollect(
    eventEmitter: EventEmitter,
    runtime: ScriptRuntime,
    device: StubDevice,
    marker: string,
    event?: SupportedDeviceEvent,
    timeoutMs = 5_000,
): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const logs: string[] = [];
        const timer = setTimeout(
            () => reject(new Error(`Timeout waiting for marker "${marker}". Got: ${JSON.stringify(logs)}`)),
            timeoutMs,
        );
        eventEmitter.on(AutomationEventType.consoleLog, (msg: string) => {
            logs.push(msg);
            if (msg === marker) {
                clearTimeout(timer);
                resolve(logs);
            }
        });
        runtime.runForEvent(event ?? { type: DeviceManagerEvent.deviceConnected, device, args: [] });
    });
}

const TEST_END_MARKER = 'DONE';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScriptRuntime (isolated-vm)', () => {
    let eventEmitter: EventEmitter;
    let runtime: ScriptRuntime;
    let repo: StubRepo;
    let deviceA: StubDevice;
    let deviceB: StubDevice;

    beforeEach(() => {
        eventEmitter = new EventEmitter();
        deviceA = new StubDevice(DeviceId.create('device-a'), 'Device A');
        deviceB = new StubDevice(DeviceId.create('device-b'), 'Device B');
        repo = new StubRepo([deviceA, deviceB]);
        const logger = mock<Logger>();
        logger.child.mockReturnValue(mock<Logger>());
        runtime = new ScriptRuntime(repo, tmpdir(), eventEmitter, logger);
    });

    afterEach(async () => {
        await runtime.stop();
    });

    it('emits scriptStarted on load and scriptStopped on stop', async () => {
        const events: string[] = [];
        eventEmitter.on(AutomationEventType.scriptStarted, () => events.push('started'));
        eventEmitter.on(AutomationEventType.scriptStopped, () => events.push('stopped'));

        await runtime.load("onEvent('deviceConnected', () => {});");

        expect(events).toEqual(['started']);
        expect(runtime.isRunning()).toBe(true);
        expect(runtime.getRunningSince()).toBeInstanceOf(Date);

        await runtime.stop();

        expect(events).toEqual(['started', 'stopped']);
        expect(runtime.isRunning()).toBe(false);
        expect(runtime.getRunningSince()).toBeNull();
    });

    it('runForEvent does nothing when not loaded', () => {
        // Should not throw
        runtime.runForEvent({ type: DeviceManagerEvent.deviceConnected, device: deviceA, args: [] });
    });

    it('onStart handler runs before scriptStarted', async () => {
        const order: string[] = [];
        eventEmitter.on(AutomationEventType.scriptStarted, () => order.push('scriptStarted'));

        await runtime.load(`
            onStart(async () => { /* setup */ });
            onEvent('deviceConnected', () => {});
        `);

        expect(order).toEqual(['scriptStarted']);
    });

    it('onStop handler runs on stop', async () => {
        const logsPromise = new Promise<string>((resolve) => {
            eventEmitter.on(AutomationEventType.consoleLog, resolve);
        });

        await runtime.load(`
            onStop(async () => { console.log('stopped'); });
            onEvent('deviceConnected', () => {});
        `);

        await runtime.stop();
        expect(await logsPromise).toBe('stopped');
    });

    it('console.log emits consoleLog event', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                console.log('hello world');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, 'hello world');
        expect(logs).toContain('hello world');
    });

    // -----------------------------------------------------------------------
    // event name filtering
    // -----------------------------------------------------------------------

    it('handler is only called for its registered event type', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                console.log('deviceConnected');
            });
        `);

        const logs = await dispatchAndCollect(
            eventEmitter, runtime, deviceA, 'deviceConnected',
        );
        expect(logs).toContain('deviceConnected');
    });

    it('handler is not called for a different event type', async () => {
        await runtime.load(`
            onEvent('deviceDisconnected', async (device) => {
                console.log('deviceDisconnected');
            });
            onEvent('deviceConnected', async (device) => {
                console.log('deviceConnected');
            });
        `);

        const logs = await dispatchAndCollect(
            eventEmitter, runtime, deviceA, 'deviceDisconnected',
            { type: DeviceManagerEvent.deviceDisconnected, device: deviceA, args: [] },
        );
        expect(logs).toContain('deviceDisconnected');
        expect(logs).not.toContain('deviceConnected');
    });

    // -----------------------------------------------------------------------
    // device identity
    // -----------------------------------------------------------------------

    it('device.getDeviceId and getDeviceName are correct', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                console.log(device.getDeviceId);
                console.log(device.getDeviceName);
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain(deviceA.getDeviceId);
        expect(logs).toContain(deviceA.getDeviceName);
    });

    // -----------------------------------------------------------------------
    // device.getAttribute
    // -----------------------------------------------------------------------

    it('device.getAttribute returns { value } for an existing attribute', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const attr = await device.getAttribute('label');
                console.log(attr !== undefined ? attr.value : 'undefined');
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('hello');
    });

    it('device.getAttribute returns undefined for a missing attribute', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const attr = await device.getAttribute('nonexistent');
                console.log(String(attr));
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('undefined');
    });

    // -----------------------------------------------------------------------
    // device.setAttribute
    // -----------------------------------------------------------------------

    it('device.setAttribute calls through to the host device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                await device.setAttribute('label', 'new-value');
                console.log('${TEST_END_MARKER}');
            });
        `);

        await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(deviceA.setAttributeCalls).toEqual([['label', 'new-value']]);
    });

    // -----------------------------------------------------------------------
    // devices.getById
    // -----------------------------------------------------------------------

    it('devices.getById returns a proxy for a known device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('${deviceB.getDeviceId}');
                console.log(d !== null ? d.getDeviceId : 'null');
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain(deviceB.getDeviceId);
    });

    it('devices.getById returns null for an unknown device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('ghost');
                console.log(d === null ? 'null' : 'not-null');
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('null');
    });

    it('devices.getById proxy can setAttribute on a different device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('${deviceB.getDeviceId}');
                await d.setAttribute('label', 'from-script');
                console.log('${TEST_END_MARKER}');
            });
        `);

        await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(deviceB.setAttributeCalls).toEqual([['label', 'from-script']]);
    });

    // -----------------------------------------------------------------------
    // devices.getAll
    // -----------------------------------------------------------------------

    it('devices.getAll returns proxies for all devices', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const all = devices.getAll();
                console.log(String(all.length));
                all.forEach(d => console.log(d.getDeviceId));
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('2');
        expect(logs).toContain(deviceA.getDeviceId);
        expect(logs).toContain(deviceB.getDeviceId);
    });

    // -----------------------------------------------------------------------
    // devices.getById with getAttribute
    // -----------------------------------------------------------------------

    it('devices.getById getAttribute returns the attribute value', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('${deviceA.getDeviceId}');
                const attr = await d.getAttribute('label');
                console.log(String(attr !== undefined ? attr.value : null));
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('hello');
    });

    it('devices.getById getAttribute returns null for an unknown device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('ghost');
                const attr = d !== null ? await d.getAttribute('label') : undefined;
                console.log(String(attr !== undefined ? attr.value : null));
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('null');
    });

    // -----------------------------------------------------------------------
    // devices.getById with setAttribute
    // -----------------------------------------------------------------------

    it('devices.getById setAttribute calls through to the host device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                await devices.getById('${deviceB.getDeviceId}').setAttribute('label', 'updated');
                console.log('${TEST_END_MARKER}');
            });
        `);

        await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(deviceB.setAttributeCalls).toEqual([['label', 'updated']]);
    });

    it('devices.getById setAttribute on unknown device does not throw', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('ghost');
                if (d !== null) await d.setAttribute('label', 'x');
                console.log('${TEST_END_MARKER}');
            });
        `);

        // Should complete without error
        await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
    });

    // -----------------------------------------------------------------------
    // Event queue ordering
    // -----------------------------------------------------------------------

    it('processes multiple events in order', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                console.log(device.getDeviceId);
            });
        `);

        const received: string[] = [];
        const allDone = new Promise<void>((resolve) => {
            let count = 0;
            eventEmitter.on(AutomationEventType.consoleLog, (msg: string) => {
                received.push(msg);
                if (++count >= 2) resolve();
            });
        });

        runtime.runForEvent({ type: DeviceManagerEvent.deviceConnected, device: deviceA, args: [] });
        runtime.runForEvent({ type: DeviceManagerEvent.deviceConnected, device: deviceB, args: [] });

        await allDone;
        expect(received).toEqual([deviceA.getDeviceId, deviceB.getDeviceId]);
    });

    // -----------------------------------------------------------------------
    // Script without onEvent handler (fire-and-forget top-level code)
    // -----------------------------------------------------------------------

    it('script without onEvent completes event dispatch immediately', async () => {
        await runtime.load('// no onEvent registered');

        // Should not throw or hang
        runtime.runForEvent({ type: DeviceManagerEvent.deviceConnected, device: deviceA, args: [] });

        // Give the queue a moment to process
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(runtime.isRunning()).toBe(true);
    });
});
