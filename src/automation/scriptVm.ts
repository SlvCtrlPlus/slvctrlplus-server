import ivm from 'isolated-vm';
import { EventEmitter } from 'events';

/**
 * Event map for the `signals` EventEmitter that bridges the isolate's __done/__lifecycleDone
 * completion callbacks to promise-based waiters. Exported so ScriptVmFactory (which owns the
 * emitter until it's handed to a ScriptVm) is type-checked against the exact same map ScriptVm
 * listens with - a typo or signature mismatch on either side is now a compile error.
 */
export type ScriptVmSignalEvents = {
    eventDone: [errMsg: string | null];
    lifecycleDone: [errMsg: string | null];
};

/**
 * A single ready-to-run script: owns the isolate/context that host it and the two refs used to
 * talk to it (dispatch a device event, dispatch a lifecycle phase), and exposes them as a small
 * behavior-oriented API instead of raw isolated-vm primitives. Built once per load()/stop() cycle
 * by ScriptVmFactory.create() and torn down as a unit via dispose().
 *
 * A constructed ScriptVm is always fully ready - the factory only returns one after successfully
 * obtaining both refs - so start()/stop()/dispatchEvent() never have a "not initialized" case to
 * handle; they can only ever resolve (ran fine) or reject (the script itself reported a failure).
 *
 * `signals` is the same EventEmitter the factory's __done/__lifecycleDone isolate callbacks emit
 * on directly - it's constructed before the isolate/script even run, so those callbacks never
 * need a forward reference to this (not-yet-existing) instance.
 */
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

    /** Runs the script's 'start' lifecycle event and waits for it to signal completion. */
    public start(): Promise<void>
    {
        return this.dispatchLifecycle('start');
    }

    /** Runs the script's 'stop' lifecycle event and waits for it to signal completion. */
    public stop(): Promise<void>
    {
        return this.dispatchLifecycle('stop');
    }

    private dispatchLifecycle(phase: 'start' | 'stop'): Promise<void>
    {
        const done = this.waitFor('lifecycleDone');
        void this.lifecycleRef.apply(undefined, [phase], { arguments: { copy: true } });
        return done;
    }

    /** Dispatches a device event into the script and waits for its handler(s) to complete. */
    public dispatchEvent(eventType: string, deviceJson: string, args: unknown): Promise<void>
    {
        const done = this.waitFor('eventDone');
        void this.dispatchRef.apply(undefined, [eventType, deviceJson, args], { arguments: { copy: true } });
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

    /** Releases the isolate/context. */
    public dispose(): void
    {
        this.vmContext.release();
        this.isolate.dispose();
    }
}
