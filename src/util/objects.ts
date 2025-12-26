type StringKey<T> = Extract<keyof T, string>;

export const getTypedKeys = <T extends object>(obj: T): (StringKey<T>)[] => {
    return Object.keys(obj) as StringKey<T>[];
}
