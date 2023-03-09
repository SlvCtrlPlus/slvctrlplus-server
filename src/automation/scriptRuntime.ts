import {NodeVM, VMScript} from "vm2";
import Device from "../device/device.js";
import DeviceRepositoryInterface from "../repository/deviceRepositoryInterface.js";
import DeviceEventType from "../device/deviceEventType.js";
import fs, {WriteStream} from "fs";
import readLastLines from "read-last-lines/dist/index.js";
import EventEmitter from "events";

type DeviceEvent = { type: string|null, device: Device|null }
type Sandbox = {
    devices: DeviceRepositoryInterface,
    event: DeviceEvent
    context: { [key: string]: string }
}

export declare interface ScriptRuntime {
    on(event: 'consoleLog', listener: (data: string) => void): this;
}

export class ScriptRuntime extends EventEmitter
{

    private scriptCode: VMScript = null;

    private vm: NodeVM = null;

    private sandbox: Sandbox;

    private readonly deviceRepository: DeviceRepositoryInterface;

    private readonly logPath: string;

    private logWriter: WriteStream;

    public constructor(deviceRepository: DeviceRepositoryInterface, logPath: string) {
        super();
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
            this.emit('consoleLog', data);
        });

        console.log('script loaded')
    }

    public unload(): void
    {
        this.vm = null;
        this.sandbox = null;
        this.logWriter.close();

        console.log('script unloaded')
    }

    public runForEvent(eventType: DeviceEventType, device: Device): void
    {
        if (null === this.vm) {
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
            this.emit('consoleLog', msg);
        }
    }

    public async getLog(maxLines: number): Promise<string>
    {
        return readLastLines.read(`${this.logPath}/automation.log`, maxLines);
    }

    private log(data: string): void
    {
        this.logWriter.write(`${data}\n`);
    }
}

export default ScriptRuntime;
