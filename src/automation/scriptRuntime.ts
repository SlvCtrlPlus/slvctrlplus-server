import ivm from 'isolated-vm';
import Device from '../device/device.js';
import DeviceRepositoryInterface from '../repository/deviceRepositoryInterface.js';
import fs, { WriteStream } from 'fs';
import readLastLines from 'read-last-lines/dist/index.js';
import EventEmitter from 'events';
import AutomationEventType from './automationEventType.js';
import { DeviceManagerEvent } from '../device/deviceManager.js';
import { AttributeValue } from '../device/attribute/deviceAttribute.js';

// @todo use own runtime events instead of device manager events, so that the script can decide which events to react to and which not
type SupportedDeviceEvent = {
    type: Extract<
        DeviceManagerEvent,
        DeviceManagerEvent.deviceConnected | DeviceManagerEvent.deviceDisconnected | DeviceManagerEvent.deviceRefreshed
    >|null,
    device: Device|null,
}

type ScriptRuntimeEvents = {
    [AutomationEventType.consoleLog]: (data: string) => void,
    [AutomationEventType.scriptStarted]: () => void,
    [AutomationEventType.scriptStopped]: () => void,
}

/**
 * Bootstrap code injected into every isolate context before the user script runs.
 *
 * Globals prefixed with `__` are set from the host via `jail.set()` before this runs:
 *   - __log             Reference – host console sink
 *   - __eventType       string|null – current event type
 *   - __eventDeviceId   string      – triggering device id
 *   - __eventDeviceName string      – triggering device name
 *   - __contextJson     string      – JSON-serialised persistent context map
 *   - __setContext      Reference – persist a context key back to the host
 *   - __getAttribute    Reference – async: (deviceId, attrName) => JSON string|null
 *   - __setAttribute    Reference – async: (deviceId, attrName, value) => void
 *   - __getDeviceJson   Reference – sync:  (deviceId) => JSON string|null
 *   - __getDevicesJson  Reference – sync:  () => JSON string of [{id, name}]
 *
 * Script-facing API:
 *   console.log(...)
 *   event                              – { type, device: { id, name } }
 *   context                            – persistent key-value map
 *   devices.getById(id)                – DeviceProxy | null
 *   devices.getAll()                   – DeviceProxy[]
 *   device.getAttribute(attrName)      – Promise<{ value } | undefined>
 *   device.setAttribute(attrName, val) – Promise<void>
 *   getAttribute(deviceId, attrName)   – Promise<value | null>  (convenience)
 *   setAttribute(deviceId, attrName, val) – Promise<void>       (convenience)
 *   getDevices()                       – [{ id, name }]         (convenience)
 */
const BOOTSTRAP_SCRIPT = `
const console = {
    log: (...args) => __log.applySync(undefined, args.map(a => String(a)), { arguments: { copy: true } })
};

// Internal: resolves to { value } or null
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
        id,
        name,
        async getAttribute(attributeName) {
            const attr = await __resolveAttr(id, attributeName);
            return attr ?? undefined;
        },
        async setAttribute(attributeName, value) {
            return __setAttribute.apply(
                undefined,
                [id, attributeName, value],
                { arguments: { copy: true }, result: { copy: true, promise: true } }
            );
        }
    });
}

const event = Object.freeze({
    type: __eventType,
    device: __createDeviceProxy(__eventDeviceId, __eventDeviceName)
});

const context = new Proxy(JSON.parse(__contextJson), {
    set(target, key, value) {
        target[key] = value;
        __setContext.applySync(undefined, [String(key), String(value)], { arguments: { copy: true } });
        return true;
    }
});

const devices = Object.freeze({
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

// Convenience functions (standalone, no device object needed)
async function getAttribute(deviceId, attributeName) {
    const attr = await __resolveAttr(deviceId, attributeName);
    return attr !== null ? attr.value : null;
}

async function setAttribute(deviceId, attributeName, value) {
    return __setAttribute.apply(
        undefined,
        [deviceId, attributeName, value],
        { arguments: { copy: true }, result: { copy: true, promise: true } }
    );
}

function getDevices() {
    return JSON.parse(__getDevicesJson.applySync(undefined, [], { result: { copy: true } }));
}
`;

export class ScriptRuntime
{
    private readonly eventEmitter: EventEmitter;

    private isolate: ivm.Isolate|null = null;

    private compiledBootstrap: ivm.Script|null = null;

    private compiledScript: ivm.Script|null = null;

    private readonly deviceRepository: DeviceRepositoryInterface;

    private readonly logPath: string;

    private logWriter: WriteStream|null = null;

    private runningSince: Date|null = null;

    private context: Record<string, string> = {};

    public constructor(deviceRepository: DeviceRepositoryInterface, logPath: string, eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
        this.deviceRepository = deviceRepository;
        this.logPath = logPath;
    }

    public load(scriptCode: string): void
    {
        this.isolate = new ivm.Isolate({ memoryLimit: 128 });
        this.compiledBootstrap = this.isolate.compileScriptSync(BOOTSTRAP_SCRIPT);
        this.compiledScript = this.isolate.compileScriptSync(`(async () => { ${scriptCode} })()`);
        this.context = {};

        this.logWriter = fs.createWriteStream(`${this.logPath}/automation.log`);
        this.runningSince = new Date();

        this.eventEmitter.emit(AutomationEventType.scriptStarted);
        console.log('script loaded');
    }

    public stop(): void
    {
        if (this.isolate !== null) {
            this.isolate.dispose();
            this.isolate = null;
        }

        this.compiledBootstrap = null;
        this.compiledScript = null;
        this.context = {};
        this.runningSince = null;

        if (this.logWriter !== null) {
            this.logWriter.close();
            this.logWriter = null;
        }

        this.eventEmitter.emit(AutomationEventType.scriptStopped);
        console.log('script stopped');
    }

    public async runForEvent(eventType: SupportedDeviceEvent['type'], device: Device): Promise<void>
    {
        if (null === this.isolate || null === this.compiledBootstrap || null === this.compiledScript) {
            return;
        }

        const vmContext = await this.isolate.createContext();
        const jail = vmContext.global;

        await jail.set('__log', new ivm.Reference((msg: string) => {
            const str = String(msg);
            console.log(`VM stdout: ${str}`);
            this.log(str);
            this.eventEmitter.emit(AutomationEventType.consoleLog, str);
        }));

        await jail.set('__eventType', eventType);
        await jail.set('__eventDeviceId', device.getDeviceId);
        await jail.set('__eventDeviceName', device.getDeviceName);
        await jail.set('__contextJson', JSON.stringify(this.context));

        await jail.set('__setContext', new ivm.Reference((key: string, value: string) => {
            this.context[key] = value;
        }));

        await jail.set('__getAttribute', new ivm.Reference(async (deviceId: string, attrName: string): Promise<string | null> => {
            const dev = this.deviceRepository.getById(deviceId);
            if (dev === null) return null;
            const attr = await dev.getAttribute(attrName);
            if (attr === undefined) return null;
            return JSON.stringify({ value: attr.value ?? null });
        }));

        await jail.set('__getDeviceJson', new ivm.Reference((deviceId: string): string | null => {
            const dev = this.deviceRepository.getById(deviceId);
            if (dev === null) return null;
            return JSON.stringify({ id: dev.getDeviceId, name: dev.getDeviceName });
        }));

        await jail.set('__setAttribute', new ivm.Reference(async (deviceId: string, attrName: string, value: AttributeValue): Promise<void> => {
            const dev = this.deviceRepository.getById(deviceId);
            if (dev === null) return;
            // Generic constraints on setAttribute (V extends ExtractAttributeValue<TAttributes[K]>) cannot be
            // satisfied statically here: the attribute key and compatible value type are only known at runtime.
            // The cast is safe because AttributeValue covers all primitive types the isolate can transfer.
            await dev.setAttribute(attrName, value as never);
        }));

        await jail.set('__getDevicesJson', new ivm.Reference((): string => {
            return JSON.stringify(
                this.deviceRepository.getAll().map(d => ({
                    id: d.getDeviceId,
                    name: d.getDeviceName,
                }))
            );
        }));

        try {
            await this.compiledBootstrap.run(vmContext);
            const result = await this.compiledScript.run(vmContext, { promise: true });
            await result;
        } catch (e: unknown) {
            const msg = (e as Error).message;
            console.error(`VM error: ${msg}`);
            this.log(msg);
            this.eventEmitter.emit(AutomationEventType.consoleLog, (e as Error).toString());
        } finally {
            vmContext.release();
        }
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
