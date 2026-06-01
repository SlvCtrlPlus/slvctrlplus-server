import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { EventEmitter } from 'events';
import { tmpdir } from 'os';
import { ScriptRuntime, SupportedDeviceEvent } from '../../../src/automation/scriptRuntime.js';
import AutomationEventType from '../../../src/automation/automationEventType.js';
import { DeviceManagerEvent } from '../../../src/device/deviceManager.js';
import Device, { DeviceAttributes, ExtractAttributeValue } from '../../../src/device/device.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import DeviceRepositoryInterface from '../../../src/repository/deviceRepositoryInterface.js';
import StrDeviceAttribute from '../../../src/device/attribute/strDeviceAttribute.js';
import Logger from '../../../src/logging/Logger.js';

// ---------------------------------------------------------------------------
// Stub device with a single 'label' string attribute
// ---------------------------------------------------------------------------

class StubDevice extends Device {
    public readonly setAttributeCalls: Array<[string, unknown]> = [];

    public constructor(id: string, name: string) {
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

    public setAttribute<
        K extends keyof DeviceAttributes & string,
        V extends ExtractAttributeValue<DeviceAttributes[K]>
    >(attributeName: K, value: V): Promise<V> {
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
    eventType: SupportedDeviceEvent['type'] = DeviceManagerEvent.deviceConnected,
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
        runtime.runForEvent(eventType, device);
    });
}

const TEST_END_MARKER = 'DONE';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScriptRuntime (isolated-vm)', () => {
    let runtime: ScriptRuntime;
    let eventEmitter: EventEmitter;
    let deviceA: StubDevice;
    let deviceB: StubDevice;
    let repo: StubRepo;

    beforeEach(() => {
        eventEmitter = new EventEmitter();
        deviceA = new StubDevice('device-a', 'Device A');
        deviceB = new StubDevice('device-b', 'Device B');
        repo = new StubRepo([deviceA, deviceB]);
        const logger = mock<Logger>();
        logger.child.mockReturnValue(mock<Logger>());
        runtime = new ScriptRuntime(repo, tmpdir(), eventEmitter, logger);
    });

    afterEach(async () => {
        if (runtime.isRunning()) {
            await runtime.stop();
        }
    });

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    it('emits scriptStarted on load and scriptStopped on stop', async () => {
        const events: string[] = [];
        eventEmitter.on(AutomationEventType.scriptStarted, () => events.push('started'));
        eventEmitter.on(AutomationEventType.scriptStopped, () => events.push('stopped'));

        await runtime.load('onEvent(() => {});');

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
        runtime.runForEvent(DeviceManagerEvent.deviceConnected, deviceA);
    });

    it('onStart handler runs before scriptStarted', async () => {
        const logs: string[] = [];
        eventEmitter.on(AutomationEventType.consoleLog, (msg: string) => logs.push(msg));

        await runtime.load(`
            onStart(async () => {
                console.log('start-called');
            });
            onEvent(() => {});
        `);

        expect(logs).toContain('start-called');
    });

    it('onStop handler runs on stop', async () => {
        await runtime.load(`
            onStop(async () => {
                console.log('stop-called');
            });
            onEvent(() => {});
        `);

        const logs: string[] = [];
        eventEmitter.on(AutomationEventType.consoleLog, (msg: string) => logs.push(msg));

        await runtime.stop();

        expect(logs).toContain('stop-called');
    });

    // -----------------------------------------------------------------------
    // console.log
    // -----------------------------------------------------------------------

    it('console.log emits consoleLog event', async () => {
        await runtime.load(`
            onEvent(async () => {
                console.log('hello world');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, 'hello world');
        expect(logs).toContain('hello world');
    });

    // -----------------------------------------------------------------------
    // event.type
    // -----------------------------------------------------------------------

    it('event.type is the correct string', async () => {
        await runtime.load(`
            onEvent(async (event) => {
                console.log(event.type);
            });
        `);

        const logs = await dispatchAndCollect(
            eventEmitter, runtime, deviceA, DeviceManagerEvent.deviceConnected,
        );
        expect(logs).toContain('deviceConnected');
    });

    it('event.type reflects the dispatched event type', async () => {
        await runtime.load(`
            onEvent(async (event) => {
                console.log(event.type);
            });
        `);

        const logs = await dispatchAndCollect(
            eventEmitter, runtime, deviceA, DeviceManagerEvent.deviceDisconnected,
            DeviceManagerEvent.deviceDisconnected,
        );
        expect(logs).toContain('deviceDisconnected');
    });

    // -----------------------------------------------------------------------
    // event.device identity
    // -----------------------------------------------------------------------

    it('event.device.getDeviceId and getDeviceName are correct', async () => {
        await runtime.load(`
            onEvent(async (event) => {
                console.log(event.device.getDeviceId);
                console.log(event.device.getDeviceName);
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('device-a');
        expect(logs).toContain('Device A');
    });

    // -----------------------------------------------------------------------
    // event.device.getAttribute
    // -----------------------------------------------------------------------

    it('event.device.getAttribute returns { value } for an existing attribute', async () => {
        await runtime.load(`
            onEvent(async (event) => {
                const attr = await event.device.getAttribute('label');
                console.log(attr !== undefined ? attr.value : 'undefined');
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('hello');
    });

    it('event.device.getAttribute returns undefined for a missing attribute', async () => {
        await runtime.load(`
            onEvent(async (event) => {
                const attr = await event.device.getAttribute('nonexistent');
                console.log(String(attr));
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('undefined');
    });

    // -----------------------------------------------------------------------
    // event.device.setAttribute
    // -----------------------------------------------------------------------

    it('event.device.setAttribute calls through to the host device', async () => {
        await runtime.load(`
            onEvent(async (event) => {
                await event.device.setAttribute('label', 'new-value');
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
            onEvent(async (event) => {
                const d = devices.getById('device-b');
                console.log(d !== null ? d.getDeviceId : 'null');
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('device-b');
    });

    it('devices.getById returns null for an unknown device', async () => {
        await runtime.load(`
            onEvent(async (event) => {
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
            onEvent(async (event) => {
                const d = devices.getById('device-b');
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
            onEvent(async (event) => {
                const all = devices.getAll();
                console.log(String(all.length));
                all.forEach(d => console.log(d.getDeviceId));
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('2');
        expect(logs).toContain('device-a');
        expect(logs).toContain('device-b');
    });

    // -----------------------------------------------------------------------
    // devices.getById with getAttribute
    // -----------------------------------------------------------------------

    it('devices.getById getAttribute returns the attribute value', async () => {
        await runtime.load(`
            onEvent(async (event) => {
                const d = devices.getById('device-a');
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
            onEvent(async (event) => {
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
            onEvent(async (event) => {
                await devices.getById('device-b').setAttribute('label', 'updated');
                console.log('${TEST_END_MARKER}');
            });
        `);

        await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(deviceB.setAttributeCalls).toEqual([['label', 'updated']]);
    });

    it('devices.getById setAttribute on unknown device does not throw', async () => {
        await runtime.load(`
            onEvent(async (event) => {
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
            onEvent(async (event) => {
                console.log(event.device.getDeviceId);
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

        runtime.runForEvent(DeviceManagerEvent.deviceConnected, deviceA);
        runtime.runForEvent(DeviceManagerEvent.deviceConnected, deviceB);

        await allDone;
        expect(received).toEqual(['device-a', 'device-b']);
    });

    // -----------------------------------------------------------------------
    // Script without onEvent handler (fire-and-forget top-level code)
    // -----------------------------------------------------------------------

    it('dispatching an event with no onEvent handler does nothing', async () => {
        await runtime.load('// no onEvent registered');

        // Should not throw or hang
        runtime.runForEvent(DeviceManagerEvent.deviceConnected, deviceA);

        // Give the queue a moment to process
        await new Promise(resolve => setTimeout(resolve, 100));
    });
});
