type JsonObject = { [key: string]: JsonValue };

type JsonValue =
    | null
    | boolean
    | number
    | string
    | JsonValue[]
    | JsonObject;

export type AllOrNone<T> = (T & {}) | Partial<Record<keyof T, never>>;

type DefaultEventMap = [never];
type Listener<K, T> = T extends DefaultEventMap ? (...args: any[]) => void : (
    K extends keyof T ? (
            T[K] extends unknown[] ? (...args: T[K]) => void : never
            )
        : never
    );
