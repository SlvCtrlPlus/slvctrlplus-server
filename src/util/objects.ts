type StringKey<T> = Extract<keyof T, string>;

export const getTypedKeys = <T extends object>(obj: T): (StringKey<T>)[] => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Object.keys(obj) as StringKey<T>[];
}

export const hasProperty = <K extends string>(obj: unknown, property: K): obj is Record<K, unknown> => {
    return typeof obj === 'object' && obj !== null && property in obj;
}
