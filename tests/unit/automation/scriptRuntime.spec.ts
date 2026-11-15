import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { EventEmitter } from 'events';
import { tmpdir } from 'os';
import { Type } from '@sinclair/typebox';
import ScriptRuntime, { SupportedDeviceEvent } from '../../../src/automation/scriptRuntime.js';
import ScriptVmFactory from '../../../src/automation/scriptVmFactory.js';
import AutomationEventType from '../../../src/automation/automationEventType.js';
import { DeviceManagerEvent } from '../../../src/device/deviceManager.js';
import Device from '../../../src/device/device.js';
import type { DeviceAttributeValues, DeviceDataApplyError, DeviceDataUpdate } from '../../../src/device/device.js';
import DeviceRepositoryInterface from '../../../src/repository/deviceRepositoryInterface.js';
import Logger from '../../../src/logging/Logger.js';
import { DeviceId } from '../../../src/device/deviceId.js';
import { strProperty } from '../../../src/device/attribute/attributeSchema.js';
import type JsonSchemaValidatorFactory from '../../../src/schemaValidation/JsonSchemaValidatorFactory.js';
import type JsonSchemaValidator from '../../../src/schemaValidation/JsonSchemaValidator.js';
import type { TSchema } from '@sinclair/typebox';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Mock validator factory (always passes)
// ---------------------------------------------------------------------------

function createMockValidatorFactory(): JsonSchemaValidatorFactory {
    const mockValidator = mock<JsonSchemaValidator<TSchema>>();
    mockValidator.validate.mockReturnValue(true);
    mockValidator.getValidationErrors.mockReturnValue([]);

    const factory = mock<JsonSchemaValidatorFactory>();
    factory.create.mockReturnValue(mockValidator);

    return factory;
}

// ---------------------------------------------------------------------------
// Stub device with a single 'label' string attribute
// ---------------------------------------------------------------------------

type StubDeviceData = { label: string };

class StubDevice extends Device<StubDeviceData> {
    public readonly updateCalls: Array<DeviceDataUpdate<StubDeviceData>> = [];

    public constructor(id: DeviceId, name: string) {
        const logger = mock<Logger>();
        logger.child.mockReturnValue(mock<Logger>());

        const schema = Type.Object({
            label: strProperty({ label: 'Label' }),
        });

        super(
            { deviceId: id, deviceName: name, provider: 'test', connectedSince: new Date(), controllable: true },
            schema,
            { label: 'hello' },
            createMockValidatorFactory(),
            {},
            new EventEmitter(),
            logger,
        );
    }

    protected override async applyDeviceData(update: DeviceDataUpdate<StubDeviceData>): Promise<DeviceDataApplyError[]> {
        this.updateCalls.push(update);
        Object.assign(this.data, update);
        return [];
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
        const scriptVmFactory = new ScriptVmFactory(repo, logger);
        runtime = new ScriptRuntime(scriptVmFactory, tmpdir(), eventEmitter, logger);
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
        expect(() => runtime.runForEvent({ type: DeviceManagerEvent.deviceConnected, device: deviceA, args: [] })).not.toThrow();
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

    it('console.log formats object arguments as JSON instead of [object Object]', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                console.log({ foo: 'bar', nested: { baz: 42 } });
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toHaveLength(2);

        const [log] = logs;
        assert(log !== undefined, 'Expected at least one log entry');

        expect(log).not.toContain('[object Object]');
        expect(JSON.parse(log)).toStrictEqual({ foo: 'bar', nested: { baz: 42 } });
    });

    it('console.log formats array and mixed arguments readably', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                console.log('values:', [1, 2, 3], true, undefined, null);
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs[0]).toBe('values: [\n  1,\n  2,\n  3\n] true undefined null');
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
    // device.getDeviceData
    // -----------------------------------------------------------------------

    it('device.getDeviceData returns full device data blob', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const data = await device.getDeviceData();
                console.log(data !== null ? data.label : 'null');
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('hello');
    });

    it('device.getDeviceData returns null for a nonexistent device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('ghost');
                if (d === null) {
                    console.log('null');
                } else {
                    const data = await d.getDeviceData();
                    console.log(String(data));
                }
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('null');
    });

    // -----------------------------------------------------------------------
    // device.updateDeviceData
    // -----------------------------------------------------------------------

    it('device.updateDeviceData calls through to the host device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                await device.updateDeviceData({ label: 'new-value' });
                console.log('${TEST_END_MARKER}');
            });
        `);

        await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(deviceA.updateCalls).toEqual([{ label: 'new-value' }]);
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

    it('devices.getById proxy can updateDeviceData on a different device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('${deviceB.getDeviceId}');
                await d.updateDeviceData({ label: 'from-script' });
                console.log('${TEST_END_MARKER}');
            });
        `);

        await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(deviceB.updateCalls).toEqual([{ label: 'from-script' }]);
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
    // devices.getById with getDeviceData
    // -----------------------------------------------------------------------

    it('devices.getById getDeviceData returns the device data blob', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('${deviceA.getDeviceId}');
                const data = await d.getDeviceData();
                console.log(String(data !== null ? data.label : null));
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('hello');
    });

    it('devices.getById getDeviceData returns null for an unknown device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('ghost');
                if (d === null) {
                    console.log('null');
                } else {
                    const data = await d.getDeviceData();
                    console.log(String(data !== null ? data.label : null));
                }
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(logs).toContain('null');
    });

    // -----------------------------------------------------------------------
    // devices.getById with updateDeviceData
    // -----------------------------------------------------------------------

    it('devices.getById updateDeviceData calls through to the host device', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                await devices.getById('${deviceB.getDeviceId}').updateDeviceData({ label: 'updated' });
                console.log('${TEST_END_MARKER}');
            });
        `);

        await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);
        expect(deviceB.updateCalls).toEqual([{ label: 'updated' }]);
    });

    it('devices.getById updateDeviceData on unknown device does not throw', async () => {
        await runtime.load(`
            onEvent('deviceConnected', async (device) => {
                const d = devices.getById('ghost');
                if (d !== null) await d.updateDeviceData({ label: 'x' });
                console.log('${TEST_END_MARKER}');
            });
        `);

        const logs = await dispatchAndCollect(eventEmitter, runtime, deviceA, TEST_END_MARKER);

        expect(logs).toContain(TEST_END_MARKER);
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
