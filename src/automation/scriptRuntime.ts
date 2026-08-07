import { AnyDevice, AnyDeviceNotification } from '../device/device.js';
import fs, { WriteStream } from 'fs';
import readLastLines from 'read-last-lines';
import EventEmitter from 'events';
import AutomationEventType from './automationEventType.js';
import { DeviceManagerEvent } from '../device/deviceManager.js';
import Logger from '../logging/Logger.js';
import ScriptVmFactory, { deviceToBridgeJson } from './scriptVmFactory.js';
import ScriptVm from './scriptVm.js';

export type SupportedDeviceEvent =
    | { type: DeviceManagerEvent.deviceConnected | DeviceManagerEvent.deviceDisconnected | DeviceManagerEvent.deviceRefreshed, device: AnyDevice, args: [] }
    | { type: DeviceManagerEvent.deviceNotification, device: AnyDevice, args: [notification: AnyDeviceNotification] };

type ScriptRuntimeEvents = {
    [AutomationEventType.consoleLog]: (data: string) => void;
    [AutomationEventType.scriptStarted]: () => void;
    [AutomationEventType.scriptStopped]: () => void;
};

const AUTOMATION_LOG_FILENAME = 'automation.log';

export default class ScriptRuntime
{
    private readonly eventEmitter: EventEmitter;

    private readonly scriptVmFactory: ScriptVmFactory;

    private vm: ScriptVm | null = null;

    // Distinct from `vm !== null`: cleared immediately when stop() begins so new/in-flight
    // runForEvent() calls bail out right away, even though `vm` itself stays alive a little
    // longer (until after the 'stop' lifecycle event has been dispatched to it).
    private acceptingEvents = false;

    private readonly logPath: string;

    private readonly logger: Logger;

    private logWriter: WriteStream | null = null;

    private runningSince: Date | null = null;

    private eventQueue: (() => Promise<void>)[] = [];

    private processQueuePromise: Promise<void> | null = null;

    public constructor(scriptVmFactory: ScriptVmFactory, logPath: string, eventEmitter: EventEmitter, logger: Logger) {
        this.eventEmitter = eventEmitter;
        this.scriptVmFactory = scriptVmFactory;
        this.logPath = logPath;
        this.logger = logger.child({ name: ScriptRuntime.name });
    }

    public async load(scriptCode: string): Promise<void>
    {
        this.logWriter = await this.openLogWriter(this.logFilePath());

        let vm: ScriptVm;

        try {
            vm = await this.scriptVmFactory.create(scriptCode, message => {
                this.log(message);
                this.eventEmitter.emit(AutomationEventType.consoleLog, message);
            });
            this.vm = vm;
        } catch (e) {
            this.logWriter.destroy();
            this.logWriter = null;
            throw e;
        }

        // From here on the script is considered running: stop() no longer no-ops, so it (not
        // vm.dispose()) is what's relied on to clean up if the onStart hook below fails.
        this.runningSince = new Date();
        this.acceptingEvents = true;

        try {
            await vm.start();
        } catch (e) {
            await this.stop();
            throw e;
        }

        this.eventEmitter.emit(AutomationEventType.scriptStarted);
        this.logger.info('script loaded');
    }

    public async stop(): Promise<void>
    {
        // isRunning() (runningSince !== null) and vm !== null are set/cleared together in
        // load()/this block below, so this also guarantees vm below is non-null.
        if (!this.isRunning() || this.vm === null) {
            return;
        }

        const vm = this.vm;

        // Stop accepting new events first so runForEvent() returns early for any events
        // arriving during teardown, and queued-but-not-started tasks resolve immediately.
        this.acceptingEvents = false;

        // Unblock any in-flight event handler so processQueue() can exit its await
        vm.cancelPending('script stopped');
        this.eventQueue = [];

        // Wait for the processQueue coroutine to finish before tearing down the isolate
        if (this.processQueuePromise !== null) {
            await this.processQueuePromise;
            this.processQueuePromise = null;
        }

        // Runs the script's 'stop' lifecycle event, logging (not throwing) on failure since
        // we're already mid-teardown here.
        try {
            await vm.stop();
        } catch (e: unknown) {
            this.logger.error('onStop error:', e instanceof Error ? e.message : String(e));
        }

        vm.dispose();
        this.vm = null;

        this.runningSince = null;

        if (this.logWriter !== null) {
            const writer = this.logWriter;
            this.logWriter = null;
            await new Promise<void>(resolve => writer.close(() => resolve()));
        }

        this.eventEmitter.emit(AutomationEventType.scriptStopped);
        this.logger.info('script stopped');
    }

    public runForEvent(event: SupportedDeviceEvent): void
    {
        if (!this.acceptingEvents) {
            return;
        }

        this.eventQueue.push(() => {
            const vm = this.vm;
            if (!this.acceptingEvents || vm === null) {
                return Promise.resolve();
            }

            return vm.dispatchEvent(event.type, deviceToBridgeJson(event.device), event.args);
        });

        this.processQueuePromise ??= this.processQueue();
    }

    private async processQueue(): Promise<void>
    {
        while (this.eventQueue.length > 0) {
            const task = this.eventQueue.shift();

            if (undefined === task) {
                continue;
            }

            try {
                await task();
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                this.logger.error(`VM error: ${msg}`);
                this.log(msg);
                this.eventEmitter.emit(AutomationEventType.consoleLog, msg);
            }
        }

        this.processQueuePromise = null;
    }

    public async getLog(maxLines: number): Promise<string>
    {
        try {
            return await readLastLines.read(this.logFilePath(), maxLines);
        } catch (e: unknown) {
            // No script has run yet (or its log file was not created) - treat as empty log
            // rather than an error condition.
            if (e instanceof Error && e.message.includes('file does not exist')) {
                return '';
            }

            throw e;
        }
    }

    public isRunning(): boolean
    {
        return null !== this.runningSince;
    }

    public getRunningSince(): Date | null
    {
        return this.runningSince;
    }

    private log(data: string): void
    {
        this.logWriter?.write(`${data}\n`);
    }

    private logFilePath(): string
    {
        return `${this.logPath}/${AUTOMATION_LOG_FILENAME}`;
    }

    /**
     * Opens `filePath` for writing and waits until it's actually open. On failure the half-open
     * stream is destroyed before rethrowing, so the caller never has anything of its own to tear
     * down.
     */
    private async openLogWriter(filePath: string): Promise<WriteStream>
    {
        const writer = fs.createWriteStream(filePath);
        writer.on('error', err => {
            this.logger.error(`Automation log write error: ${err.message}`);
        });

        try {
            await new Promise<void>((resolve, reject) => {
                writer.once('open', () => resolve());
                writer.once('error', err => reject(err));
            });
        } catch (e) {
            writer.destroy();
            throw e;
        }

        return writer;
    }

    public on<E extends keyof ScriptRuntimeEvents>(event: E, listener: ScriptRuntimeEvents[E]): this
    {
        this.eventEmitter.on(event, listener);
        return this;
    }

    public off<E extends keyof ScriptRuntimeEvents>(event: E, listener: ScriptRuntimeEvents[E]): this
    {
        this.eventEmitter.off(event, listener);
        return this;
    }
}
