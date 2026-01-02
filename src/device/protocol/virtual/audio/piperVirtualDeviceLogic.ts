import {DeviceAttributeModifier} from "../../../attribute/deviceAttribute.js";
import StrDeviceAttribute from "../../../attribute/strDeviceAttribute.js";
import VirtualDeviceLogic from "../virtualDeviceLogic.js";
import VirtualDevice from "../virtualDevice.js";
import BoolDeviceAttribute from "../../../attribute/boolDeviceAttribute.js";
import IntDeviceAttribute from "../../../attribute/intDeviceAttribute.js";
import {Int} from "../../../../util/numbers.js";
import {JsonObject} from "../../../../types.js";
import Logger from "../../../../logging/Logger.js";
import {ChildProcessByStdio, spawn} from "node:child_process";
import {Readable, Writable} from "stream";
import Speaker from "speaker";

type PiperVirtualDeviceAttributes = {
    text: StrDeviceAttribute;
    speaking: BoolDeviceAttribute;
    queuing: BoolDeviceAttribute;
    queueLength: IntDeviceAttribute;
}

export default class PiperVirtualDeviceLogic implements VirtualDeviceLogic<PiperVirtualDeviceAttributes> {

    private static readonly textAttrName: string = 'text';
    private static readonly speakingAttrName: string = 'speaking';
    private static readonly queuingAttrName: string = 'queuing';
    private static readonly queueLengthAttrName: string = 'queueLength';

    private ttsQueue: string[] = [];

    private readonly config: JsonObject;

    private readonly logger: Logger;

    private piperProcess: ChildProcessByStdio<Writable, Readable, Readable>;
    private playProcess?: ChildProcessByStdio<Writable, Readable, Readable>;

    public constructor(config: JsonObject, logger: Logger) {
        this.config = config;
        this.logger = logger.child({ name: PiperVirtualDeviceLogic.name });
        this.piperProcess = this.startPiper();
    }

    private startPiper(): ChildProcessByStdio<Writable, Readable, Readable> {
        const speaker = new Speaker({
            channels: 1,
            bitDepth: 16,
            sampleRate: 22050
        });

        const piperProcess = spawn(
            "piper",
            ["--model", this.config.model as string, "--output-raw"],
            {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                env: { ...process.env, PIPER_NO_PLAYER: "1" },
                stdio: ["pipe", "pipe", "pipe"],
            }
        );

        piperProcess.stdout.pipe(speaker);

        piperProcess.stderr.on("data", (data: Buffer) => {
            this.logger.error("Piper stderr: %s", data.toString());
        });

        piperProcess.stdin.on('error', (err: Error) => {
            this.logger.error("Piper stdin error:", err);
        });
        piperProcess.on('close', (code, signal) => {
            this.logger.error(`Piper process closed (code: ${code}, signal: ${signal})`);
        });

        this.logger.info(`Piper started with model: ${this.config.model as string}`);

        return piperProcess;
    }

    /* private startPlayback(): void {
        if (undefined !== this.playProcess) return;

        this.playProcess = spawn(
            "play",
            [
                "-q", // Suppress output
                "-t", "raw",
                "-e", "signed-integer",
                "-b", "16",
                "-c", "1",
                "-r", "22050",
                "-v", "0.98",
                "-"
            ],
            { stdio: ["pipe", "pipe", "pipe"] }
        );

        this.playProcess.on("exit", () => {
            this.logger.error(`play process exited`);
            this.playProcess = undefined;
        });

        this.playProcess.on("error", (e: Error) => {
            this.logger.error(`Error in play process: ${e.message}`, e);
        });

        this.playProcess.stderr.on("data", (e: Buffer) => {
            this.logger.error(`Error in play stderr process: ${e.toString()}`, e);
        });

        this.playProcess.stdin.on("error", (e: Error) => {
            this.logger.error(`Error in play stdin process: ${e.message}`, e);
        });

        this.piperProcess.stdout.pipe(this.playProcess.stdin);

        this.logger.debug("play started");
    }

    private stopPlayback(): void {
        if (undefined === this.playProcess) return;

        // this.audioBus.unpipe(this.playProcess.stdin);
        this.playProcess.kill("SIGKILL");
        this.playProcess = undefined;

        this.logger.debug("play stopped");
    }*/

    public async refreshData(
        device: VirtualDevice<PiperVirtualDeviceAttributes>
    ): Promise<void> {
        const text = (await device.getAttribute("text"))?.value;
        const queuing = (await device.getAttribute("queuing"))?.value ?? false;
        const speaking = (await device.getAttribute("speaking"))?.value ?? false;

        /* Handle new text */
        if (text !== undefined) {
            if (!queuing) {
                this.ttsQueue.length = 0;
                // this.stopPlayback(); // interrupt immediately
            }

            this.ttsQueue.push(text);
            await device.setAttribute(
                "queueLength",
                Int.from(this.ttsQueue.length)
            );
            await device.setAttribute("text", undefined);
        }

        if (this.ttsQueue.length === 0) {
            if (speaking) {
                await device.setAttribute("speaking", false);
            }
            return;
        }

        /* Already speaking and queuing enabled → do nothing */
        if (speaking && queuing) return;

        /* Start playback if needed */
        // this.startPlayback();
        await device.setAttribute("speaking", true);

        const next = this.ttsQueue.shift();
        await device.setAttribute(
            "queueLength",
            Int.from(this.ttsQueue.length)
        );

        if (next !== undefined) {
            if (!this.piperProcess.stdin.destroyed) {
                this.logger.debug(`Output: ${next}`);
                this.piperProcess.stdin.write(next + "\n");
            } else {
                this.logger.error("Piper or play process stdin is not writable.");
            }
        }
    }

    public configureAttributes(): PiperVirtualDeviceAttributes {
        return {
            text: StrDeviceAttribute.create(
                PiperVirtualDeviceLogic.textAttrName,
                "Text",
                DeviceAttributeModifier.writeOnly
            ),

            speaking: BoolDeviceAttribute.createInitialized(
                PiperVirtualDeviceLogic.speakingAttrName,
                "Currently speaking",
                DeviceAttributeModifier.readOnly,
                false
            ),

            queuing: BoolDeviceAttribute.createInitialized(
                PiperVirtualDeviceLogic.queuingAttrName,
                "Queuing enabled",
                DeviceAttributeModifier.readWrite,
                false
            ),

            queueLength: IntDeviceAttribute.createInitialized(
                PiperVirtualDeviceLogic.queueLengthAttrName,
                "Queue length",
                DeviceAttributeModifier.readOnly,
                undefined,
                Int.ZERO
            ),
        };
    }

    public get getRefreshInterval(): number {
        return 50;
    }
}
