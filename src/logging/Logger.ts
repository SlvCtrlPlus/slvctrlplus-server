export default interface Logger
{
    child(config?: object, context?: unknown): Logger;

    trace(msg: string, context?: unknown): void;
    debug(msg: string, context?: unknown): void;
    info(msg: string, context?: unknown): void;
    warn(msg: string, context?: unknown): void;
    error(msg: string, context?: unknown): void;
    fatal(msg: string, context?: unknown): void;
}
