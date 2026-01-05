import {
    spawn,
    ChildProcess,
    ChildProcessByStdio,
    ChildProcessWithoutNullStreams,
    SpawnOptions,
    SpawnOptionsWithoutStdio,
    SpawnOptionsWithStdioTuple,
    StdioNull,
    StdioPipe,
} from "node:child_process";
import {Readable, Writable} from "stream";

// Overloads matching node:child_process spawn signatures

export function spawnProcess(command: string, args?: readonly string[], options?: SpawnOptionsWithoutStdio): Promise<ChildProcessWithoutNullStreams>;
export function spawnProcess(command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioPipe, StdioPipe, StdioPipe>): Promise<ChildProcessByStdio<Writable, Readable, Readable>>;
export function spawnProcess(command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioPipe, StdioPipe, StdioNull>): Promise<ChildProcessByStdio<Writable, Readable, null>>;
export function spawnProcess(command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioPipe, StdioNull, StdioPipe>): Promise<ChildProcessByStdio<Writable, null, Readable>>;
export function spawnProcess(command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe>): Promise<ChildProcessByStdio<null, Readable, Readable>>;
export function spawnProcess(command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioPipe, StdioNull, StdioNull>): Promise<ChildProcessByStdio<Writable, null, null>>;
export function spawnProcess(command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioNull>): Promise<ChildProcessByStdio<null, Readable, null>>;
export function spawnProcess(command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioNull, StdioNull, StdioPipe>): Promise<ChildProcessByStdio<null, null, Readable>>;
export function spawnProcess(command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioNull, StdioNull, StdioNull>): Promise<ChildProcessByStdio<null, null, null>>;
export function spawnProcess(command: string, args: readonly string[], options: SpawnOptions): Promise<ChildProcess>;

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function spawnProcess(
    command: string,
    args?: readonly string[],
    options?: SpawnOptions
): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const child = spawn(command, args ?? [], options ?? {});

        child.once("error", e => {
            if (settled) return;
            settled = true;

            if ('code' in e) {
                switch (e.code) {
                    case 'ENOENT': e.message = `Executable '${command}' not found`; break;
                    case 'EACCES': e.message = 'Permission denied'; break;
                    case 'EISDIR': e.message = 'Is a directory, not an executable'; break;
                    case 'EMFILE': e.message = 'Too many open files'; break;
                }
            }

            reject(e);
        });
        child.once("spawn", () => {
            if (settled) return;
            settled = true;
            resolve(child);
        });
    });
}
