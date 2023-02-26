type JsonObject = { [key: string]: JsonValue };

type JsonValue =
    | null
    | boolean
    | number
    | string
    | JsonValue[]
    | JsonObject;
