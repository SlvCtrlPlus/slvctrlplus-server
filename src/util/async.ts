export const sleep = async (ms: number): Promise<void> => new Promise<void>(r => {
    setTimeout(r, ms);
});

export class IntervalTimeoutError extends Error {
    public constructor(timeoutMs: number) {
        super(`Interval function timed out (>${timeoutMs}ms)`);
        this.name = 'IntervalTimeoutError';
    }
}

export const setImmediateInterval = <TArgs extends unknown[]>(
    callback: (...args: TArgs) => void,
    delay?: number,
    ...args: TArgs
): NodeJS.Timeout => {
    callback(...args);
    return setInterval(callback, delay, ...args);
};

export type IntervalAsyncOptions = {
    intervalMs: number;
    runImmediately?: boolean;
    timeoutMs?: number;
    onError?: (err: unknown) => void;
};

export const asyncHandler = <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<void>,
    onError: (err: unknown) => void,
): (...args: TArgs) => void => {
    return (...args: TArgs): void => {
        fn(...args).catch(onError);
    };
};

export type IntervalAsync = { clear: () => void };

export const setIntervalAsync = <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<void>,
    options: IntervalAsyncOptions,
    ...args: TArgs
): IntervalAsync => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async (): Promise<void> => {
        const promises = [fn(...args)];

        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

        if (undefined !== options.timeoutMs) {
            const timeoutMs = options.timeoutMs;
            promises.push(new Promise<void>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new IntervalTimeoutError(timeoutMs));
                }, timeoutMs);
            }));
        }

        try {
            await Promise.race(promises);
        } catch (err) {
            if (options.onError) {
                options.onError(err);
            } else {
                throw err;
            }
        } finally {
            clearTimeout(timeoutHandle);

            if (!stopped) {
                timer = setTimeout(() => {
                    void loop();
                }, options.intervalMs);
            }
        }
    };

    if (options.runImmediately ?? true) {
        void loop();
    } else {
        timer = setTimeout(() => {
            void loop();
        }, options.intervalMs);
    }

    return {
        clear: (): void => {
            stopped = true;
            if (timer) clearTimeout(timer);
        },
    };
};

export const promiseWithTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = `Promise timed out after ${timeoutMs}ms`,
): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutHandle);
    });
};
