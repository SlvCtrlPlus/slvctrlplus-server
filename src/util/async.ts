export const sleep = (ms: number): Promise<void> => new Promise<void>(r => setTimeout(r, ms));

export const setImmediateInterval = <TArgs extends any[]>(
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
}

export const setIntervalAsync = <TArgs extends any[]>(
  fn: (...args: TArgs) => Promise<void>,
  options: IntervalAsyncOptions,
  ...args: TArgs
) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const loop = async () => {
    const promises = [fn(...args)];

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    if (undefined !== options.timeoutMs) {
      promises.push(new Promise<void>((_, reject) =>
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Interval function timed out (>${options.timeoutMs}ms)`));
        }, options.timeoutMs))
      );
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
        timer = setTimeout(loop, options.intervalMs);
      }
    }
  };

  if (options.runImmediately ?? false) {
    void loop();
  } else {
    timer = setTimeout(loop, options.intervalMs);
  }

  return {
    clear: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    }
  };
}

export type IntervalAsync = ReturnType<typeof setIntervalAsync>;
