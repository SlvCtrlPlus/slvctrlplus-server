import Device from "../device/device.js";
import DeviceRepositoryInterface from "../repository/deviceRepositoryInterface.js";
import fs, {WriteStream} from "fs";
import readLastLines from "read-last-lines/dist/index.js";
import EventEmitter from "events";
import AutomationEventType from "./automationEventType.js";
import DeviceManagerEvent from "../device/deviceManagerEvent.js";
import ivm, {TransferOptions} from 'isolated-vm';
import Logger from "../logging/Logger.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import DeviceDiscriminator from "../serialization/discriminator/deviceDiscriminator.js";
import {ResultTypeSync} from "isolated-vm/isolated-vm.js";

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

    private scriptCode: ivm.Script = null;

    private vm: ivm.Isolate = null;

    private context: ivm.Context = null;

    private sandbox: Sandbox;

    private eventFunction: ResultTypeSync<TransferOptions, Record<number | string | symbol, any>["event"]> = null;

    private readonly deviceRepository: DeviceRepositoryInterface;

    private readonly logPath: string;

    private logWriter: WriteStream;

    private runningSince: Date = null;

    private readonly logger: Logger;

    private readonly serializer: ClassToPlainSerializer;

    public constructor(
        deviceRepository: DeviceRepositoryInterface,
        logPath: string,
        eventEmitter: EventEmitter,
        logger: Logger,
        serializer: ClassToPlainSerializer
    ) {
        this.eventEmitter = eventEmitter;
        this.deviceRepository = deviceRepository;
        this.logPath = logPath;
        this.logger = logger.child({name: 'scriptRuntime'});
        this.serializer = serializer;
    }

    public async load(scriptCode: string): Promise<ResultTypeSync<TransferOptions, 'event'>>
    {
        this.sandbox = {
            event: { type: null, device: null },
            devices: this.deviceRepository,
            context: {},
        }

        this.vm = new ivm.Isolate({ memoryLimit: 8 /* MB */ });

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
        jail.setSync('_log', (...args: any[]) => {
            //this.logger.info(`VM stdout: ${args}`, args);
            console.log(...args);
            //void this.log(args);
            this.eventEmitter.emit(AutomationEventType.consoleLog, args);
        });
        jail.setSync('getDevice', (id: string) => {
            const device = this.deviceRepository.getById(id);
            const deviceDiscriminator = DeviceDiscriminator.createClassTransformerTypeDiscriminator('type');

            return this.serializer.transform(device, deviceDiscriminator);
        });
        this.context.evalSync(`globalThis.event = function (message) {
            _log('lol: ' + message);
        }`)

        this.eventFunction = this.context.global.getSync('event');

        this.runningSince = new Date();

        this.logger.info('script loaded');

        try {
            await this.scriptCode.run(this.context);

            this.eventEmitter.emit(AutomationEventType.scriptStarted);

            return this.eventFunction;
        } catch (e: unknown) {
            const msg = (e as Error).message;
            this.logger.error(`VM stdout: ${msg}`);
            void this.log(msg);
            this.eventEmitter.emit(AutomationEventType.consoleLog, (e as Error).toString());
        }
    }

    public stop(): void
    {
        this.vm = null;
        this.sandbox = null;
        this.logWriter.close();
        this.runningSince = null;

        this.eventEmitter.emit(AutomationEventType.scriptStopped);
        this.logger.info('script stopped');
    }

    public runForEvent(eventType: DeviceManagerEvent, device: Device): void
    {
        this.eventFunction.applySync(undefined, ['Hello world from the outside'], {timeout: 1000});
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
