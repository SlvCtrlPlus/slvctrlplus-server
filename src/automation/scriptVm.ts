import ivm from 'isolated-vm';
import { EventEmitter } from 'events';

export type ScriptVmSignalEvents = {
    eventDone: [errMsg: string | null];
    lifecycleDone: [errMsg: string | null];
};

export const LIFECYCLE_START = 'start';
export const LIFECYCLE_STOP = 'stop';
type LifecyclePhase = typeof LIFECYCLE_START | typeof LIFECYCLE_STOP;

export default class ScriptVm
{
    private readonly isolate: ivm.Isolate;

    private readonly vmContext: ivm.Context;

    private readonly dispatchRef: ivm.Reference;

    private readonly lifecycleRef: ivm.Reference;

    private readonly signals: EventEmitter<ScriptVmSignalEvents>;

    public constructor(
        isolate: ivm.Isolate,
        vmContext: ivm.Context,
        dispatchRef: ivm.Reference,
        lifecycleRef: ivm.Reference,
        signals: EventEmitter<ScriptVmSignalEvents>,
    ) {
        this.isolate = isolate;
        this.vmContext = vmContext;
        this.dispatchRef = dispatchRef;
        this.lifecycleRef = lifecycleRef;
        this.signals = signals;
    }

    public start(): Promise<void>
    {
        return this.dispatchLifecycle(LIFECYCLE_START);
    }

    public stop(): Promise<void>
    {
        return this.dispatchLifecycle(LIFECYCLE_STOP);
    }

    /** Dispatches a device event into the script and waits for its handler(s) to complete. */
    public dispatchEvent(eventType: string, deviceJson: string, args: unknown): Promise<void>
    {
        const done = this.waitFor('eventDone');
        void this.dispatchRef.apply(undefined, [eventType, deviceJson, args], { arguments: { copy: true } });
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

    private dispatchLifecycle(phase: LifecyclePhase): Promise<void>
    {
        const done = this.waitFor('lifecycleDone');
        void this.lifecycleRef.apply(undefined, [phase], { arguments: { copy: true } });
        return done;
    }

    private waitFor(channel: keyof ScriptVmSignalEvents): Promise<void>
    {
        return new Promise<void>((resolve, reject) => {
            this.signals.once(channel, (errMsg) => {
                if (errMsg !== null) reject(new Error(errMsg));
                else resolve();
            });
        });
    }
}
