import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import SharedObserver from '../../../../src/device/transport/sharedObserver.js';
import Logger from '../../../../src/logging/Logger.js';

class TestObserver extends SharedObserver
{
    public firstStarts = 0;
    public lastStops = 0;
    public failNextStart = false;

    public constructor() {
        super(mock<Logger>());
    }

    protected async onFirstStart(): Promise<void> {
        this.firstStarts++;

        if (this.failNextStart) {
            this.failNextStart = false;
            throw new Error('startup failed');
        }
    }

    protected async onLastStop(): Promise<void> {
        this.lastStops++;
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
});
