type StringKey<T> = Extract<keyof T, string>;

export const getTypedKeys = <T extends object>(obj: T): (StringKey<T>)[] => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Object.keys(obj) as StringKey<T>[];
}
