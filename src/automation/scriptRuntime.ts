import Device from "../device/device.js";
import DeviceRepositoryInterface from "../repository/deviceRepositoryInterface.js";
import fs, {WriteStream} from "fs";
import readLastLines from "read-last-lines/dist/index.js";
import EventEmitter from "events";
import AutomationEventType from "./automationEventType.js";
import DeviceManagerEvent from "../device/deviceManagerEvent.js";
import {Context, Isolate, Script} from "isolated-vm/isolated-vm.js";

type DeviceEvent = { type: string|null, device: Device|null }
type Sandbox = {
    devices: DeviceRepositoryInterface,
    event: DeviceEvent
    context: { [key: string]: string }
}

type ScriptRuntimeEvents = {
    [AutomationEventType.consoleLog]: (data: string) => void,
    [AutomationEventType.scriptStarted]: () => void,
    [AutomationEventType.scriptStopped]: () => void,
}

export class ScriptRuntime
{
    private readonly eventEmitter: EventEmitter;

    private scriptCode: Script = null;

    private vm: Isolate = null;

    private context: Context = null;

    private sandbox: Sandbox;

    private readonly deviceRepository: DeviceRepositoryInterface;

    private readonly logPath: string;

    private logWriter: WriteStream;

    private runningSince: Date = null;

    public constructor(deviceRepository: DeviceRepositoryInterface, logPath: string, eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
        this.deviceRepository = deviceRepository;
        this.logPath = logPath;
    }

    public load(scriptCode: string): void
    {
        this.sandbox = {
            event: { type: null, device: null },
            devices: this.deviceRepository,
            context: {},
        }

        this.vm = new Isolate({ memoryLimit: 8 /* MB */ });

        this.scriptCode = this.vm.compileScriptSync(scriptCode);
        this.context = this.vm.createContextSync();
        this.context.evalSync('const context = {};');

        this.logWriter = fs.createWriteStream(`${this.logPath}/automation.log`);

        // Get a Reference{} to the global object within the context.
        const jail = this.context.global;

        // This makes the global object available in the context as `global`. We use `derefInto()` here
        // because otherwise `global` would actually be a Reference{} object in the new isolate.
        jail.setSync('global', jail.derefInto());

        // We will create a basic `log` function for the new isolate to use.
        jail.setSync('console.log', (...args: any[]) => {
            console.log(`VM stdout: ${args}`);
            void this.log(args);
            this.eventEmitter.emit(AutomationEventType.consoleLog, args);
        });
        jail.setSync('devices', () => this.deviceRepository);

        this.runningSince = new Date();

        this.eventEmitter.emit(AutomationEventType.scriptStarted);
        console.log('script loaded')
    }

    public stop(): void
    {
        this.vm = null;
        this.sandbox = null;
        this.logWriter.close();
        this.runningSince = null;

        this.eventEmitter.emit(AutomationEventType.scriptStopped);
        console.log('script stopped')
    }

    public runForEvent(eventType: DeviceManagerEvent, device: Device): void
    {
        if (null === this.vm) {
            return;
        }

        this.sandbox.event.type = eventType;
        this.sandbox.event.device = device;

        try {
            this.scriptCode.runSync(this.context);
        } catch (e: unknown) {
            const msg = (e as Error).message;
            console.error(`VM stdout: ${msg}`);
            void this.log(msg);
            this.eventEmitter.emit(AutomationEventType.consoleLog, (e as Error).toString());
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

    public getRunningSince(): Date
    {
        return this.runningSince;
    }

    private log(data: string): void
    {
        this.logWriter.write(`${data}\n`);
    }

    public on<E extends keyof ScriptRuntimeEvents> (event: E, listener: ScriptRuntimeEvents[E]): this
    {
        this.eventEmitter.on(event, listener);
        return this;
    }
}

export default ScriptRuntime;
