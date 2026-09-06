import ivm from 'isolated-vm';
import { EventEmitter } from 'events';
import { transform } from 'sucrase';
import type DeviceRepositoryInterface from '../repository/deviceRepositoryInterface.js';
import type { AnyDevice } from '../device/device.js';
import type Logger from '../logging/Logger.js';
import type { ScriptVmSignalEvents } from './scriptVm.js';
import ScriptVm, { LIFECYCLE_START } from './scriptVm.js';
import type { DeviceId } from '../device/deviceId.js';

type BridgeDevice = {
    id: string;
    name: string;
};

const toBridgeDevice = (device: AnyDevice): BridgeDevice => {
    return { id: device.getDeviceId, name: device.getDeviceName };
};

export const deviceToBridgeJson = (device: AnyDevice): string => {
    return JSON.stringify(toBridgeDevice(device));
};

const VM_REF_LOG = '__log';
const VM_REF_GET_ATTRIBUTE = '__getAttribute';
const VM_REF_SET_ATTRIBUTE = '__setAttribute';
const VM_REF_GET_DEVICE_JSON = '__getDeviceJson';
const VM_REF_GET_DEVICES_JSON = '__getDevicesJson';
const VM_REF_DISPATCH_EVENT = '__dispatchEvent';
const VM_REF_DISPATCH_LIFECYCLE = '__dispatchLifecycle';
const VM_CALLBACK_EVENT_DONE = '__done';
const VM_CALLBACK_LIFECYCLE_DONE = '__lifecycleDone';

const BOOTSTRAP_SCRIPT = `
function __formatLogArg(arg) {
    if (typeof arg === 'string') {
        return arg;
    }

    if (typeof arg === 'function') {
        return arg.toString();
    }

    if (arg === null || typeof arg !== 'object') {
        return String(arg);
    }

    if (arg instanceof Error) {
        return arg.stack ?? \`\${arg.name}: \${arg.message}\`;
    }

    try {
        const seen = new WeakSet();
        return JSON.stringify(arg, (_key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular]';
                }
                seen.add(value);
            }

            return typeof value === 'bigint' ? value.toString() : value;
        }, 2);
    } catch (e) {
        return String(arg);
    }
}

function __formatLogArgs(args) {
    return args.map(__formatLogArg).join(' ');
}

var console = {
    log:   (...args) => ${VM_REF_LOG}.applySync(undefined, ['log',   __formatLogArgs(args)], { arguments: { copy: true } }),
    error: (...args) => ${VM_REF_LOG}.applySync(undefined, ['error', __formatLogArgs(args)], { arguments: { copy: true } }),
    warn:  (...args) => ${VM_REF_LOG}.applySync(undefined, ['warn',  __formatLogArgs(args)], { arguments: { copy: true } }),
    info:  (...args) => ${VM_REF_LOG}.applySync(undefined, ['info',  __formatLogArgs(args)], { arguments: { copy: true } }),
    debug: (...args) => ${VM_REF_LOG}.applySync(undefined, ['debug', __formatLogArgs(args)], { arguments: { copy: true } }),
    trace: (...args) => ${VM_REF_LOG}.applySync(undefined, ['trace', __formatLogArgs(args)], { arguments: { copy: true } }),
};

async function __resolveAttr(deviceId, attributeName) {
    const json = await ${VM_REF_GET_ATTRIBUTE}.apply(
        undefined,
        [deviceId, attributeName],
        { arguments: { copy: true }, result: { copy: true, promise: true } }
    );
    return json !== null ? JSON.parse(json) : null;
}

function __createDeviceProxy(d) {
    return Object.freeze({
        get getDeviceId() { return d.id; },
        get getDeviceName() { return d.name; },
        async getAttribute(attributeName) {
            const attr = await __resolveAttr(d.id, attributeName);
            return attr ?? undefined;
        },
        async setAttribute(attributeName, value) {
            await ${VM_REF_SET_ATTRIBUTE}.apply(
                undefined,
                [d.id, attributeName, value],
                { arguments: { copy: true }, result: { promise: true } }
            );
        }
    });
}

var devices = Object.freeze({
    getById(deviceId) {
        const json = ${VM_REF_GET_DEVICE_JSON}.applySync(undefined, [deviceId], { arguments: { copy: true }, result: { copy: true } });
        if (json === null) return null;
        return __createDeviceProxy(JSON.parse(json));
    },
    getAll() {
        const all = JSON.parse(${VM_REF_GET_DEVICES_JSON}.applySync(undefined, [], { result: { copy: true } }));
        return all.map(__createDeviceProxy);
    }
});

var __eventHandlers = {};

function onEvent(eventName, fn) {
    if (!__eventHandlers[eventName]) __eventHandlers[eventName] = [];
    __eventHandlers[eventName].push(fn);
}

var __startHandler = null;
var __stopHandler = null;

function onStart(fn) {
    __startHandler = fn;
}

function onStop(fn) {
    __stopHandler = fn;
}

var ${VM_REF_DISPATCH_LIFECYCLE} = function(phase) {
    var handler = phase === '${LIFECYCLE_START}' ? __startHandler : __stopHandler;
    if (handler === null) { ${VM_CALLBACK_LIFECYCLE_DONE}(null); return; }
    var result;
    try {
        result = handler();
    } catch (err) {
        ${VM_CALLBACK_LIFECYCLE_DONE}(String(err));
        return;
    }
    if (result !== null && result !== undefined && typeof result.then === 'function') {
        result.then(function() { ${VM_CALLBACK_LIFECYCLE_DONE}(null); }, function(err) { ${VM_CALLBACK_LIFECYCLE_DONE}(String(err)); });
    } else {
        ${VM_CALLBACK_LIFECYCLE_DONE}(null);
    }
};

// ${VM_CALLBACK_EVENT_DONE} is an ivm.Callback set by the host that signals event-handler completion.
// It is called with null on success, or an error string on failure.
var ${VM_REF_DISPATCH_EVENT} = function(eventType, deviceJson, args) {
    const handlers = __eventHandlers[eventType] || [];
    if (handlers.length === 0) { ${VM_CALLBACK_EVENT_DONE}(null); return; }
    const device = __createDeviceProxy(JSON.parse(deviceJson));
    var chain = Promise.resolve();
    handlers.forEach(function(handler) {
        chain = chain.then(function() {
            var result;
            try {
                result = handler(device, ...args);
            } catch (err) {
                return Promise.reject(err);
            }
            return (result !== null && result !== undefined && typeof result.then === 'function') ? result : undefined;
        });
    });
    chain.then(function() { ${VM_CALLBACK_EVENT_DONE}(null); }, function(err) { ${VM_CALLBACK_EVENT_DONE}(String(err)); });
};
`;

/**
 * Builds isolated-vm sandboxes for automation scripts: creates the isolate/context, wires up the
 * host bridge functions (device access, console, lifecycle/event signalling), and compiles + runs
 * the bootstrap and user script inside it.
 */
export default class ScriptVmFactory
{
    private readonly deviceRepository: DeviceRepositoryInterface;

    private readonly automationScriptLogger: Logger;

    private readonly logger: Logger;

    public constructor(deviceRepository: DeviceRepositoryInterface, logger: Logger) {
        this.deviceRepository = deviceRepository;
        this.automationScriptLogger = logger.child({ name: 'AutomationScript' });
        this.logger = logger;
    }

    public async create(scriptCode: string, onConsoleLog: (message: string) => void): Promise<ScriptVm>
    {
        const isolate = new ivm.Isolate({ memoryLimit: 128 });
        const signals = new EventEmitter<ScriptVmSignalEvents>();

        let vmContext: ivm.Context | undefined;

        try {
            vmContext = await isolate.createContext();

            const jail = vmContext.global;

            const loggerMethods: Record<string, (msg: string) => void> = {
                log: msg => this.automationScriptLogger.info(msg),
                error: msg => this.automationScriptLogger.error(msg),
                warn: msg => this.automationScriptLogger.warn(msg),
                info: msg => this.automationScriptLogger.info(msg),
                debug: msg => this.automationScriptLogger.debug(msg),
                trace: msg => this.automationScriptLogger.trace(msg),
            };

            await jail.set(VM_REF_LOG, new ivm.Reference((level: string, msg: unknown) => {
                const msgStr = String(msg);
                (loggerMethods[level] ?? this.automationScriptLogger.info.bind(this.automationScriptLogger))(msgStr);
                onConsoleLog(msgStr);
            }));

            await jail.set(VM_REF_GET_ATTRIBUTE, new ivm.Reference((deviceId: DeviceId, attrName: string): string | null => {
                const dev = this.deviceRepository.getById(deviceId);
                if (dev === null) return null;
                const schema = dev.getAttributesSchema();
                const propSchema = schema.properties[attrName];
                if (!propSchema) return null;
                const value = dev.getAttributeValue(attrName) ?? null;
                const rawLabel: unknown = propSchema['x-label'];
                const label = typeof rawLabel === 'string' ? rawLabel : null;
                const modifier = propSchema.readOnly === true ? 'ro' : (propSchema.writeOnly === true ? 'wo' : 'rw');
                const type = String(propSchema.type ?? 'unknown');
                return JSON.stringify({ value, name: attrName, label, modifier, type });
            }));

            await jail.set(VM_REF_GET_DEVICE_JSON, new ivm.Reference((deviceId: DeviceId): string | null => {
                const dev = this.deviceRepository.getById(deviceId);
                if (dev === null) return null;
                return deviceToBridgeJson(dev);
            }));

            await jail.set(VM_REF_SET_ATTRIBUTE, new ivm.Reference(async (deviceId: DeviceId, attrName: string, value: unknown): Promise<void> => {
                const dev = this.deviceRepository.getById(deviceId);
                if (dev === null) throw new Error(`Device not found: ${deviceId}`);
                await dev.setAttribute(attrName, value);
            }));

            await jail.set(VM_REF_GET_DEVICES_JSON, new ivm.Reference((): string => {
                return JSON.stringify(this.deviceRepository.getAll().map(toBridgeDevice));
            }));

            await jail.set(VM_CALLBACK_EVENT_DONE, new ivm.Callback((errMsg: string | null) => {
                signals.emit('eventDone', errMsg);
            }, { async: true }));

            await jail.set(VM_CALLBACK_LIFECYCLE_DONE, new ivm.Callback((errMsg: string | null) => {
                signals.emit('lifecycleDone', errMsg);
            }, { async: true }));

            const compiledBootstrap = isolate.compileScriptSync(BOOTSTRAP_SCRIPT);
            const { code: transpiledScript } = transform(scriptCode, { transforms: ['typescript'] });
            const compiledScript = isolate.compileScriptSync(transpiledScript);

            await compiledBootstrap.run(vmContext);
            await compiledScript.run(vmContext, { promise: true });

            const dispatchRef: unknown = await vmContext.global.get(VM_REF_DISPATCH_EVENT, { reference: true });
            const lifecycleRef: unknown = await vmContext.global.get(VM_REF_DISPATCH_LIFECYCLE, { reference: true });

            if (!ScriptVmFactory.isIvmReference(dispatchRef)) {
                throw new Error(`Expected '${VM_REF_DISPATCH_EVENT}' to be an ivm.Reference`);
            } else if (!ScriptVmFactory.isIvmReference(lifecycleRef)) {
                throw new Error(`Expected '${VM_REF_DISPATCH_LIFECYCLE}' to be an ivm.Reference`);
            }

            return new ScriptVm(isolate, vmContext, dispatchRef, lifecycleRef, signals, this.logger);
        } catch (e) {
            vmContext?.release();
            isolate.dispose();
            throw e;
        }
    }

    private static isIvmReference(obj: unknown): obj is ivm.Reference {
        return typeof obj === 'object' && obj !== null && 'applySync' in obj && typeof obj.applySync === 'function';
    }
}
