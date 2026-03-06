export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const setImmediateInterval = <TArgs extends any[]>(
  callback: (...args: TArgs) => void,
  delay?: number,
  ...args: TArgs
): NodeJS.Timeout => {
    callback(...args);
    return setInterval(callback, delay, ...args);
};
