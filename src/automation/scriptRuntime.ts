import ivm from 'isolated-vm';
import { transformSync } from 'esbuild';
import Device from '../device/device.js';
import DeviceRepositoryInterface from '../repository/deviceRepositoryInterface.js';
import fs, { WriteStream } from 'fs';
import readLastLines from 'read-last-lines/dist/index.js';
import EventEmitter from 'events';
import AutomationEventType from './automationEventType.js';
import { DeviceManagerEvent } from '../device/deviceManager.js';
import { AttributeValue } from '../device/attribute/deviceAttribute.js';

type AutomationDeviceEvent = Extract<
    DeviceManagerEvent,
    DeviceManagerEvent.deviceConnected | DeviceManagerEvent.deviceDisconnected | DeviceManagerEvent.deviceRefreshed
>;

export type SupportedDeviceEvent = {
    type: AutomationDeviceEvent,
    device: Device,
}

type ScriptRuntimeEvents = {
    [AutomationEventType.consoleLog]: (data: string) => void,
    [AutomationEventType.scriptStarted]: () => void,
    [AutomationEventType.scriptStopped]: () => void,
}

/**
 * Bootstrap code injected into the isolate context once on load, before the user script runs.
 *
 * Globals prefixed with `__` are set from the host via `jail.set()` before this runs:
 * - __log             Reference – host console sink
 * - __getAttribute    Reference – async: (deviceId, attrName) => JSON string|null
 * - __setAttribute    Reference – async: (deviceId, attrName, value) => void
 * - __getDeviceJson   Reference – sync:  (deviceId) => JSON string|null
 * - __getDevicesJson  Reference – sync:  () => JSON string of [{id, name}]
 * - __lifecycleDone   Callback  – signals onStart/onStop completion (null = ok, string = error)
 *
 * Script-facing API:
 * - console.log(...)
 * - onStart(handler)                      – run once when script loads: () => void | Promise<void>
 * - onStop(handler)                       – run once when script stops: () => void | Promise<void>
 * - onEvent(handler)                      – register event handler: handler receives { type, device }
 * - event.type                            – string – current event type
 * - event.device.getDeviceId              – string
 * - event.device.getDeviceName            – string
 * - event.device.getAttribute(name)       – Promise<{ value, name, label, modifier, type } | undefined>
 * - event.device.setAttribute(name, v)    – Promise<void>
 * - devices.getById(id)                   – Device | null
 * - devices.getAll()                      – Device[]
 */
const BOOTSTRAP_SCRIPT = `
var console = {
    log: (...args) => __log.applySync(undefined, args.map(a => String(a)), { arguments: { copy: true } })
};

async function __resolveAttr(deviceId, attributeName) {
    const json = await __getAttribute.apply(
        undefined,
        [deviceId, attributeName],
        { arguments: { copy: true }, result: { copy: true, promise: true } }
    );
    return json !== null ? JSON.parse(json) : null;
}

function __createDeviceProxy(id, name) {
    return Object.freeze({
        get getDeviceId() { return id; },
        get getDeviceName() { return name; },
        async getAttribute(attributeName) {
            const attr = await __resolveAttr(id, attributeName);
            return attr ?? undefined;
        },
        setAttribute(attributeName, value) {
            __setAttribute.applySync(undefined, [id, attributeName, value], { arguments: { copy: true } });
            return Promise.resolve();
        }
    });
}

var devices = Object.freeze({
    getById(deviceId) {
        const json = __getDeviceJson.applySync(undefined, [deviceId], { arguments: { copy: true }, result: { copy: true } });
        if (json === null) return null;
        const { id, name } = JSON.parse(json);
        return __createDeviceProxy(id, name);
    },
    getAll() {
        return JSON.parse(__getDevicesJson.applySync(undefined, [], { result: { copy: true } }))
            .map(({ id, name }) => __createDeviceProxy(id, name));
    }
});

var __handler = null;

function onEvent(fn) {
    __handler = fn;
}

var __startHandler = null;
var __stopHandler = null;

function onStart(fn) {
    __startHandler = fn;
}

function onStop(fn) {
    __stopHandler = fn;
}

var __dispatchLifecycle = function(phase) {
    var handler = phase === 'start' ? __startHandler : __stopHandler;
    if (handler === null) { __lifecycleDone(null); return; }
    var result;
    try {
        result = handler();
    } catch (err) {
        __lifecycleDone(String(err));
        return;
    }
    if (result !== null && result !== undefined && typeof result.then === 'function') {
        result.then(function() { __lifecycleDone(null); }, function(err) { __lifecycleDone(String(err)); });
    } else {
        __lifecycleDone(null);
    }
};

// __done is an ivm.Callback set by the host that signals event-handler completion.
// It is called with null on success, or an error string on failure.
var __dispatchEvent = function(eventType, deviceId, deviceName) {
    if (__handler === null) { __done(null); return; }
    const event = Object.freeze({
        type: eventType,
        device: __createDeviceProxy(deviceId, deviceName)
    });
    var result;
    try {
        result = __handler(event);
    } catch (err) {
        __done(String(err));
        return;
    }
    if (result !== null && result !== undefined && typeof result.then === 'function') {
        result.then(() => __done(null), (err) => __done(String(err)));
    } else {
        __done(null);
    }
};
`;

export class ScriptRuntime
{
    private readonly eventEmitter: EventEmitter;

    private isolate: ivm.Isolate|null = null;

    private vmContext: ivm.Context|null = null;

    private dispatchRef: ivm.Reference|null = null;

    private lifecycleRef: ivm.Reference|null = null;

    private pendingEventDone: ((errMsg: string | null) => void) | null = null;

    private pendingLifecycleDone: ((errMsg: string | null) => void) | null = null;

    private readonly deviceRepository: DeviceRepositoryInterface;

    private readonly logPath: string;

    private logWriter: WriteStream|null = null;

    private runningSince: Date|null = null;

    private eventQueue: (() => Promise<void>)[] = [];

    private processingQueue = false;

    public constructor(deviceRepository: DeviceRepositoryInterface, logPath: string, eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
        this.deviceRepository = deviceRepository;
        this.logPath = logPath;
    }

    public async load(scriptCode: string): Promise<void>
    {
        this.isolate = new ivm.Isolate({ memoryLimit: 128 });
        this.vmContext = await this.isolate.createContext();

        const jail = this.vmContext.global;

        await jail.set('__log', new ivm.Reference((msg: string) => {
            const str = String(msg);
            console.log(`VM stdout: ${str}`);
            this.log(str);
            this.eventEmitter.emit(AutomationEventType.consoleLog, str);
        }));

        await jail.set('__getAttribute', new ivm.Reference(async (deviceId: string, attrName: string): Promise<string | null> => {
            const dev = this.deviceRepository.getById(deviceId);
            if (dev === null) return null;
            const attr = await dev.getAttribute(attrName);
            if (attr === undefined) return null;
            return JSON.stringify({ value: attr.value ?? null, name: attr.name, label: attr.label ?? null, modifier: attr.modifier, type: attr.getType() });
        }));

        await jail.set('__getDeviceJson', new ivm.Reference((deviceId: string): string | null => {
            const dev = this.deviceRepository.getById(deviceId);
            if (dev === null) return null;
            return JSON.stringify({ id: dev.getDeviceId, name: dev.getDeviceName });
        }));

        await jail.set('__setAttribute', new ivm.Reference((deviceId: string, attrName: string, value: AttributeValue): void => {
            const dev = this.deviceRepository.getById(deviceId);
            if (dev === null) return;
            dev.setAttribute(attrName, value).catch((e: unknown) => console.error('VM setAttribute failed:', e));
        }));

        await jail.set('__getDevicesJson', new ivm.Reference((): string => {
            return JSON.stringify(
                this.deviceRepository.getAll().map(d => ({
                    id: d.getDeviceId,
                    name: d.getDeviceName,
                }))
            );
        }));

        await jail.set('__done', new ivm.Callback((errMsg: string | null) => {
            if (this.pendingEventDone !== null) {
                const done = this.pendingEventDone;
                this.pendingEventDone = null;
                done(errMsg);
            }
        }, { async: true }));

        await jail.set('__lifecycleDone', new ivm.Callback((errMsg: string | null) => {
            if (this.pendingLifecycleDone !== null) {
                const done = this.pendingLifecycleDone;
                this.pendingLifecycleDone = null;
                done(errMsg);
            }
        }, { async: true }));

        const compiledBootstrap = this.isolate.compileScriptSync(BOOTSTRAP_SCRIPT);
        const { code: transpiledScript } = transformSync(scriptCode, { loader: 'ts' });
        const compiledScript = this.isolate.compileScriptSync(transpiledScript);

        await compiledBootstrap.run(this.vmContext);
        await compiledScript.run(this.vmContext, { promise: true });

        this.dispatchRef = await this.vmContext.global.get('__dispatchEvent');
        this.lifecycleRef = await this.vmContext.global.get('__dispatchLifecycle');

        this.logWriter = fs.createWriteStream(`${this.logPath}/automation.log`);
        this.runningSince = new Date();

        const lifecycleRef = this.lifecycleRef;
        if (lifecycleRef === null) {
            throw new Error('lifecycleRef not initialized');
        }

        try {
            await new Promise<void>((resolve, reject) => {
                this.pendingLifecycleDone = (errMsg: string | null): void => {
                    if (errMsg !== null) reject(new Error(errMsg));
                    else resolve();
                };
                void lifecycleRef.apply(undefined, ['start'], { arguments: { copy: true } });
            });
        } catch (e) {
            await this.stop();
            throw e;
        }

        this.eventEmitter.emit(AutomationEventType.scriptStarted);
        console.log('script loaded');
    }

    public async stop(): Promise<void>
    {
        this.eventQueue = [];
        this.processingQueue = false;

        const lifecycleRef = this.lifecycleRef;
        if (lifecycleRef !== null) {
            try {
                await new Promise<void>((resolve, reject) => {
                    this.pendingLifecycleDone = (errMsg: string | null): void => {
                        if (errMsg !== null) reject(new Error(errMsg));
                        else resolve();
                    };
                    void lifecycleRef.apply(undefined, ['stop'], { arguments: { copy: true } });
                });
            } catch (e: unknown) {
                console.error('onStop error:', e instanceof Error ? e.message : String(e));
            }
        }

        this.dispatchRef = null;
        this.lifecycleRef = null;
        this.pendingEventDone = null;
        this.pendingLifecycleDone = null;

        if (this.vmContext !== null) {
            this.vmContext.release();
            this.vmContext = null;
        }

        if (this.isolate !== null) {
            this.isolate.dispose();
            this.isolate = null;
        }

        this.runningSince = null;

        if (this.logWriter !== null) {
            this.logWriter.close();
            this.logWriter = null;
        }

        this.eventEmitter.emit(AutomationEventType.scriptStopped);
        console.log('script stopped');
    }

    public runForEvent(eventType: SupportedDeviceEvent['type'], device: Device): void
    {
        if (null === this.dispatchRef) {
            return;
        }

        this.eventQueue.push(() => new Promise<void>((resolve, reject) => {
            if (this.dispatchRef === null) {
                resolve();
                return;
            }

            this.pendingEventDone = (errMsg: string | null): void => {
                if (errMsg !== null) {
                    reject(new Error(errMsg));
                } else {
                    resolve();
                }
            };
            void this.dispatchRef!.apply(
                undefined,
                [eventType, device.getDeviceId, device.getDeviceName],
                { arguments: { copy: true } }
            );
        }));

        if (!this.processingQueue) {
            void this.processQueue();
        }
    }

    private async processQueue(): Promise<void>
    {
        this.processingQueue = true;

        while (this.eventQueue.length > 0) {
            const task = this.eventQueue.shift()!;
            try {
                await task();
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error(`VM error: ${msg}`);
                this.log(msg);
                this.eventEmitter.emit(AutomationEventType.consoleLog, String(e));
            }
        }

        this.processingQueue = false;
    }

    public async getLog(maxLines: number): Promise<string>
    {
        return readLastLines.read(`${this.logPath}/automation.log`, maxLines);
    }

    public isRunning(): boolean
    {
        return null !== this.runningSince;
    }

    public getRunningSince(): Date|null
    {
        return this.runningSince;
    }

    private log(data: string): void
    {
        if (null !== this.logWriter) {
            this.logWriter.write(`${data}\n`);
        }
    }

    public on<E extends keyof ScriptRuntimeEvents> (event: E, listener: ScriptRuntimeEvents[E]): this
    {
        this.eventEmitter.on(event, listener);
        return this;
    }
}

export default ScriptRuntime;
