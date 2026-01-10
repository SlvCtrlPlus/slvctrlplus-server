import { ChildProcessByStdio } from 'node:child_process';
import Speaker from 'speaker';
import { Readable, Writable } from 'stream';
import { DeviceAttributeModifier } from '../../../attribute/deviceAttribute.js';
import StrDeviceAttribute from '../../../attribute/strDeviceAttribute.js';
import VirtualDevice from '../virtualDevice.js';
import BoolDeviceAttribute from '../../../attribute/boolDeviceAttribute.js';
import Logger from '../../../../logging/Logger.js';
import { spawnProcess } from '../../../../util/process.js';
import DeviceState from '../../../deviceState.js';
import { PiperVirtualDeviceConfig } from './piperVirtualDeviceConfig.js';
import DevNullStream from '../../../../util/devNullStream.js';
import VirtualDeviceLogic from '../virtualDeviceLogic.js';

type PiperVirtualDeviceAttributes = {
    text: StrDeviceAttribute;
    queuing: BoolDeviceAttribute;
}

export default class PiperVirtualDeviceLogic implements VirtualDeviceLogic<
    PiperVirtualDeviceAttributes,
    PiperVirtualDeviceConfig
> {
    private static readonly textAttrName: string = 'text';
    private static readonly queuingAttrName: string = 'queuing';

    private readonly config: PiperVirtualDeviceConfig;

    private readonly logger: Logger;

    private piperProcess?: ChildProcessByStdio<Writable, Readable, Readable>;
    private speaker?: Speaker;
    private speakerCoolDown: boolean = false;

    public constructor(config: PiperVirtualDeviceConfig, logger: Logger) {
        this.config = config;
        this.logger = logger.child({ name: PiperVirtualDeviceLogic.name });
    }

    private async startPiper(): Promise<void> {
        if (undefined !== this.piperProcess) {
            return;
        }

        try {
            const piperProcess = await spawnProcess(
                this.config.binary ?? 'piper',
                ['--model', this.config.model, '--output-raw'],
                {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    env: { ...process.env, PIPER_NO_PLAYER: '1' },
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            piperProcess.stderr.on('data', (data: Buffer) => {
                this.logger.error('Piper stderr: %s', data.toString());
            });

            piperProcess.stdin.on('error', (err: Error) => {
                this.logger.error('Piper stdin error:', err);
            });

            this.piperProcess = piperProcess;

            this.logger.info(`Piper started with model: ${this.config.model}`);
        } catch (e: unknown) {
            if (e instanceof Error) {
                this.logger.error(`Could not start piper: ${e.message}`, e);
            } else {
                this.logger.error('Could not start piper: Unknown error', e);
            }

            throw e;
        }
    }

    private startPlayback(): void {
        if (undefined === this.piperProcess || undefined !== this.speaker) {
            return;
        }

        this.logger.debug('New speaker started');

        this.speaker = new Speaker({
            channels: 1,
            bitDepth: 16,
            sampleRate: 22050
        });

        this.piperProcess.stdout.pipe(this.speaker);
    }

    private stopPlayback(): boolean {
        if (undefined === this.piperProcess || undefined === this.speaker) {
            return false;
        }

        this.piperProcess.stdout.unpipe();
        const devNull = new DevNullStream(500);
        devNull.on('idle', () => {
            this.speakerCoolDown = false;
            this.piperProcess?.stdout.unpipe();
        });
        this.piperProcess.stdout.pipe(devNull);
        this.speaker.end();
        this.speaker.destroy();
        this.speaker = undefined;
        this.speakerCoolDown = true;

        this.logger.debug('Speaker stopped');

        return true;
    }

    public async refreshData(
        device: VirtualDevice<PiperVirtualDeviceAttributes, PiperVirtualDeviceConfig>
    ): Promise<void> {
        if (device.getState === DeviceState.error) {
            return;
        }

        await this.startPiper();

        if (undefined === this.piperProcess) {
            return;
        }

        const text = (await device.getAttribute('text'))?.value;

        if (undefined === text || this.speakerCoolDown) {
            // Nothing to do if there's no new text
            return;
        }

        const queuing = (await device.getAttribute('queuing'))?.value ?? false;

        // If queuing is disabled, we must destroy speaker to end output
        // and return because we need to wait until the stdout of piper
        // process is drained (see stopPlayback() for details)
        if (!queuing && this.stopPlayback()) {
            return;
        }

        /* Start playback if needed */
        this.startPlayback();

        if (!this.piperProcess.stdin.destroyed) {
            this.logger.debug(`Send to piper process: ${text}`);
            this.piperProcess.stdin.write(text + '\n');
            await device.setAttribute('text', undefined);
        } else {
            this.logger.error('Piper or play process stdin is not writable.');
        }
    }

    public configureAttributes(): PiperVirtualDeviceAttributes {
        return {
            text: StrDeviceAttribute.create(
                PiperVirtualDeviceLogic.textAttrName,
                'Text',
                DeviceAttributeModifier.writeOnly
            ),

            queuing: BoolDeviceAttribute.createInitialized(
                PiperVirtualDeviceLogic.queuingAttrName,
                'Queuing enabled',
                DeviceAttributeModifier.readWrite,
                false
            ),
        };
    }

    public get refreshInterval(): number {
        return 50;
    }
}
