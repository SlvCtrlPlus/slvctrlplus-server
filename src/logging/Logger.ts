export type ChildLoggerBindings = {
    name?: string,
}

export type ChildLoggerOptions = {
    level?: string,
}

export type ErrorContext = Error | ({ error: Error } & { [key: string]: unknown });

export default interface Logger
{
    child(bindings?: ChildLoggerBindings, options?: ChildLoggerOptions): Logger;

    trace(msg: string, context?: unknown): void;
    debug(msg: string, context?: unknown): void;
    info(msg: string, context?: unknown): void;
    warn(msg: string, context?: unknown): void;
    error(msg: string, context?: ErrorContext | unknown): void;
    fatal(msg: string, context?: unknown): void;
}
