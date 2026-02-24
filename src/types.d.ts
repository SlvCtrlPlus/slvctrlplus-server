export type JsonObject = { [key: string]: JsonValue };

export type JsonValue =
    | null
    | boolean
    | number
    | string
    | JsonValue[]
    | JsonObject;

export type AllOrNone<T> = (T & {}) | Partial<Record<keyof T, never>>;
