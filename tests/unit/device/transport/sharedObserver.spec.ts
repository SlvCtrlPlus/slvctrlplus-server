import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import SharedObserver from '../../../../src/device/transport/sharedObserver.js';
import Logger from '../../../../src/logging/Logger.js';

class TestObserver extends SharedObserver
{
    public firstStarts = 0;
    public lastStops = 0;
    public subsequentStarts = 0;
    public failNextStart = false;

    // Allows tests to control when onFirstStart() resolves, to simulate a slow/in-flight startup.
    private firstStartGate: Promise<void> = Promise.resolve();

    public constructor() {
        super(mock<Logger>());
    }

    public setFirstStartGate(gate: Promise<void>): void {
        this.firstStartGate = gate;
    }

    protected async onFirstStart(): Promise<void> {
        this.firstStarts++;

        await this.firstStartGate;

        if (this.failNextStart) {
            this.failNextStart = false;
            throw new Error('startup failed');
        }
    }

    protected async onLastStop(): Promise<void> {
        this.lastStops++;
    }

    protected override async onSubsequentStart(): Promise<void> {
        this.subsequentStarts++;
    }
}

describe('SharedObserver', () => {
    it('does not count a failed startup as an active user', async () => {
        const observer = new TestObserver();
        observer.failNextStart = true;

        await expect(observer.start()).rejects.toThrow('startup failed');

        // The next start() must actually run onFirstStart() again instead of
        // assuming the observer is already running
        await observer.start();
        expect(observer.firstStarts).toBe(2);

        await observer.stop();
        expect(observer.lastStops).toBe(1);
    });

    it('stops only after the last user released it', async () => {
        const observer = new TestObserver();

        await observer.start();
        await observer.start();
        expect(observer.firstStarts).toBe(1);

        await observer.stop();
        expect(observer.lastStops).toBe(0);

        await observer.stop();
        expect(observer.lastStops).toBe(1);
    });

    it('does not run onSubsequentStart() for the very first caller', async () => {
        const observer = new TestObserver();

        await observer.start();

        expect(observer.subsequentStarts).toBe(0);
    });

    it('runs onSubsequentStart() for a caller joining an already-running observer', async () => {
        const observer = new TestObserver();

        await observer.start();
        await observer.start();

        expect(observer.firstStarts).toBe(1);
        expect(observer.subsequentStarts).toBe(1);

        await observer.start();
        expect(observer.subsequentStarts).toBe(2);
    });

    it('does not run onSubsequentStart() for concurrent first-time joiners', async () => {
        const observer = new TestObserver();

        let releaseFirstStart: () => void = () => undefined;
        observer.setFirstStartGate(new Promise<void>((resolve) => { releaseFirstStart = resolve; }));

        const firstStart = observer.start();
        const secondStart = observer.start();

        releaseFirstStart();
        await Promise.all([firstStart, secondStart]);

        expect(observer.firstStarts).toBe(1);
        expect(observer.subsequentStarts).toBe(0);
    });

    it('runs onSubsequentStart() again after a full stop and restart', async () => {
        const observer = new TestObserver();

        await observer.start();
        await observer.start();
        expect(observer.subsequentStarts).toBe(1);

        await observer.stop();
        await observer.stop();
        expect(observer.lastStops).toBe(1);

        await observer.start();
        expect(observer.firstStarts).toBe(2);
        expect(observer.subsequentStarts).toBe(1);

        await observer.start();
        expect(observer.subsequentStarts).toBe(2);
    });
});
