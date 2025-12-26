import {NodeVM, VMScript} from "vm2";
import Device from "../device/device.js";
import DeviceRepositoryInterface from "../repository/deviceRepositoryInterface.js";
import fs, {WriteStream} from "fs";
import readLastLines from "read-last-lines/dist/index.js";
import EventEmitter from "events";
import AutomationEventType from "./automationEventType.js";
import DeviceManagerEvent from "../device/deviceManagerEvent.js";

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

    private scriptCode: VMScript|null = null;

    private vm: NodeVM|null = null;

    private sandbox: Sandbox|null = null;

    private readonly deviceRepository: DeviceRepositoryInterface;

    private readonly logPath: string;

    private logWriter: WriteStream|null = null;

    private runningSince: Date|null = null;

    public constructor(deviceRepository: DeviceRepositoryInterface, logPath: string, eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
        this.deviceRepository = deviceRepository;
        this.logPath = logPath;
    }

    public load(scriptCode: string): void
    {
        this.scriptCode = new VMScript(scriptCode);

        this.sandbox = {
            event: { type: null, device: null },
            devices: this.deviceRepository,
            context: {},
        }

        this.vm = new NodeVM({
            console: 'redirect',
            require: {
                external: true,
                root: './',
            },
            sandbox: this.sandbox
        });

        this.logWriter = fs.createWriteStream(`${this.logPath}/automation.log`)

        this.vm.on('console.log', (data: string) => {
            console.log(`VM stdout: ${data}`);
            void this.log(data);
            this.eventEmitter.emit(AutomationEventType.consoleLog, data);
        });

        this.runningSince = new Date();

        this.eventEmitter.emit(AutomationEventType.scriptStarted);
        console.log('script loaded')
    }

    public stop(): void
    {
        this.vm = null;
        this.sandbox = null;
        this.runningSince = null;

        if (null !== this.logWriter) {
            this.logWriter.close();
        }

        this.eventEmitter.emit(AutomationEventType.scriptStopped);
        console.log('script stopped')
    }

    public runForEvent(eventType: DeviceManagerEvent, device: Device): void
    {
        if (null === this.vm || null === this.sandbox || null === this.scriptCode) {
            return;
        }

        this.sandbox.event.type = eventType;
        this.sandbox.event.device = device;

        try {
            this.vm.run(this.scriptCode);
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
