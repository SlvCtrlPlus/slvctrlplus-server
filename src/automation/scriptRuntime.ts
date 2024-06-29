import Device from "../device/device.js";
import DeviceRepositoryInterface from "../repository/deviceRepositoryInterface.js";
import fs, {WriteStream} from "fs";
import readLastLines from "read-last-lines/dist/index.js";
import EventEmitter from "events";
import AutomationEventType from "./automationEventType.js";
import DeviceManagerEvent from "../device/deviceManagerEvent.js";
import ivm, {TransferOptions, ArgumentType} from 'isolated-vm';
import Logger from "../logging/Logger.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";

type ScriptRuntimeEvents = {
    [AutomationEventType.consoleLog]: (data: string) => void,
    [AutomationEventType.scriptStarted]: () => void,
    [AutomationEventType.scriptStopped]: () => void,
}

type EventFunction = ivm.Reference<(msg: string) => void>;

export class ScriptRuntime
{
    private readonly eventEmitter: EventEmitter;

    private scriptCode: ivm.Script = null;

    private vm: ivm.Isolate = null;

    private context: ivm.Context = null;

    private eventFunction: EventFunction = null;

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

    public async load(scriptCode: string): Promise<EventFunction>
    {
        try {
            this.logger.debug(`Instantiate isolate`)
            this.vm = new ivm.Isolate({ memoryLimit: 128 /* MB */ , onCatastrophicError: message => console.error(message)});


            this.logger.debug(`Create isolate context`)
            this.context = await this.vm.createContext();

            this.logWriter = fs.createWriteStream(`${this.logPath}/automation.log`);

            // Get a Reference{} to the global object within the context.
            const jail = this.context.global;

            // This makes the global object available in the context as `global`. We use `derefInto()` here
            // because otherwise `global` would actually be a Reference{} object in the new isolate.
            this.logger.debug(`Deref gloabal into jail`)
            await jail.set('global', jail.derefInto());

            this.logger.debug(`Create shared functions`)

            // Create references to the main process functions
            const deviceGetByIdRef = new ivm.Reference((uuid: string) => this.deviceRepository.getById(uuid));
            const logRef = new ivm.Reference((data: string) => this.log(data));

            // Define and expose wrapper functions
            const deviceGetByIdWrapper = new ivm.Reference((...args: [uuid: ArgumentType<TransferOptions, string>]) => {
                return deviceGetByIdRef.applySync(undefined, args);
            });
            const logWrapper = new ivm.Reference((...args: any[]) => {
                // @ts-expect-error any stuff
                return logRef.applySync(undefined, args);
            });
            const onEventWrapper = new ivm.Reference((...args: [message: ArgumentType<TransferOptions, string>]) => {
                return logRef.applySync(undefined, args);
            });

            await jail.set('deviceGetById', deviceGetByIdWrapper);
            await jail.set('log', logWrapper);
            await jail.set('onEvent', onEventWrapper);

            this.logger.debug(`Create shared functions -> done!`)

            // Compile and run the user code
            this.logger.debug(`Compiling script...`)
            this.scriptCode = await this.vm.compileScript(scriptCode);
            this.logger.debug(`Compiling script done!`)

            this.runningSince = new Date();

            this.eventFunction = this.context.global.getSync('onDeviceEvent') as EventFunction;
            this.logger.debug('Run script...')
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
        this.logWriter.close();
        this.runningSince = null;

        this.eventEmitter.emit(AutomationEventType.scriptStopped);
        this.logger.info('script stopped');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
