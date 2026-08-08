import type ivm from 'isolated-vm';
import type { EventEmitter } from 'events';
import type Logger from '../logging/Logger.js';

export type ScriptVmSignalEvents = {
    eventDone: [errMsg: string | null];
    lifecycleDone: [errMsg: string | null];
};

export const LIFECYCLE_START = 'start';

const LIFECYCLE_STOP = 'stop';
type LifecyclePhase = typeof LIFECYCLE_START | typeof LIFECYCLE_STOP;

export default class ScriptVm
{
    private readonly isolate: ivm.Isolate;

    private readonly vmContext: ivm.Context;

    private readonly dispatchRef: ivm.Reference;

    private readonly lifecycleRef: ivm.Reference;

    private readonly signals: EventEmitter<ScriptVmSignalEvents>;

    private readonly logger: Logger;

    public constructor(
        isolate: ivm.Isolate,
        vmContext: ivm.Context,
        dispatchRef: ivm.Reference,
        lifecycleRef: ivm.Reference,
        signals: EventEmitter<ScriptVmSignalEvents>,
        logger: Logger,
    ) {
        this.isolate = isolate;
        this.vmContext = vmContext;
        this.dispatchRef = dispatchRef;
        this.lifecycleRef = lifecycleRef;
        this.signals = signals;
        this.logger = logger.child({ name: ScriptVm.name });
    }

    public async start(): Promise<void>
    {
        return this.dispatchLifecycle(LIFECYCLE_START);
    }

    public async stop(): Promise<void>
    {
        return this.dispatchLifecycle(LIFECYCLE_STOP);
    }

    /** Dispatches a device event into the script and waits for its handler(s) to complete. */
    public async dispatchEvent(eventType: string, deviceJson: string, args: unknown): Promise<void>
    {
        const done = this.waitFor('eventDone');
        // Completion is signalled via the 'eventDone' channel above; this catch only prevents an
        // unhandled rejection if the isolate is disposed while the call is still in flight.
        this.dispatchRef.apply(undefined, [eventType, deviceJson, args], { arguments: { copy: true } })
            .catch((e: unknown) => this.logger.debug('dispatchEvent call into isolate failed', e));
        return done;
    }

    /**
     * Forces any in-flight dispatchEvent()/start()/stop() call to resolve immediately with the
     * given reason as its error, without waiting for the isolate's own completion signal. Used
     * during a forced teardown so callers awaiting those calls aren't left hanging.
     */
    public cancelPending(reason: string): void
    {
        this.signals.emit('eventDone', reason);
        this.signals.emit('lifecycleDone', reason);
    }

    public dispose(): void
    {
        this.vmContext.release();
        this.isolate.dispose();
    }

    private async dispatchLifecycle(phase: LifecyclePhase): Promise<void>
    {
        const done = this.waitFor('lifecycleDone');
        // Completion is signalled via the 'lifecycleDone' channel above; this catch only prevents
        // an unhandled rejection if the isolate is disposed while the call is still in flight.
        this.lifecycleRef.apply(undefined, [phase], { arguments: { copy: true } })
            .catch((e: unknown) => this.logger.debug('dispatchLifecycle call into isolate failed', e));
        return done;
    }

    private async waitFor(channel: keyof ScriptVmSignalEvents): Promise<void>
    {
        return new Promise<void>((resolve, reject) => {
            this.signals.once(channel, errMsg => {
                if (errMsg !== null) reject(new Error(errMsg));
                else resolve();
            });
        });
    }
}
