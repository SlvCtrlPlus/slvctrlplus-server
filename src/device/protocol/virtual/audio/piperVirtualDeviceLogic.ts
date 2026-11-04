import type { ChildProcessByStdio } from 'node:child_process';
import Speaker from 'speaker';
import fs from 'fs';
import type { Readable, Writable } from 'stream';
import { DeviceAttributeModifier } from '../../../attribute/deviceAttribute.js';
import StrDeviceAttribute from '../../../attribute/strDeviceAttribute.js';
import type VirtualDevice from '../virtualDevice.js';
import type { InitializedBoolDeviceAttribute } from '../../../attribute/boolDeviceAttribute.js';
import BoolDeviceAttribute from '../../../attribute/boolDeviceAttribute.js';
import type Logger from '../../../../logging/Logger.js';
import { spawnProcess } from '../../../../util/process.js';
import DeviceState from '../../../deviceState.js';
import type { PiperVirtualDeviceConfig } from './piperVirtualDeviceConfig.js';
import DevNullStream from '../../../../util/devNullStream.js';
import VirtualDeviceLogic from '../virtualDeviceLogic.js';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { BITS_PER_BYTE } from '../../../../util/numbers.js';

const PiperModelMetadataSchema = Type.Object({
    num_speakers: Type.Optional(Type.Number()),
    sample_width: Type.Optional(Type.Number()),
    audio: Type.Optional(Type.Object({
        sample_rate: Type.Optional(Type.Number()),
    })),
});

type PiperModelMetadata = Static<typeof PiperModelMetadataSchema>;

type PiperVirtualDeviceAttributes = {
    text: StrDeviceAttribute;
    queuing: InitializedBoolDeviceAttribute;
};

export default class PiperVirtualDeviceLogic extends VirtualDeviceLogic<
    PiperVirtualDeviceAttributes,
    PiperVirtualDeviceConfig
> {
    private static readonly stdoutDrainIdleTimeoutMs = 500;
    private static readonly textAttrName: string = 'text';
    private static readonly queuingAttrName: string = 'queuing';

    public readonly refreshInterval = 175;

    private readonly logger: Logger;

    private piperProcess?: ChildProcessByStdio<Writable, Readable, Readable>;
    private speaker?: Speaker;
    private speakerOptions: Speaker.Options = {};
    private speakerCoolDown = false;

    public constructor(config: PiperVirtualDeviceConfig, logger: Logger) {
        super(config);
        this.logger = logger.child({ name: PiperVirtualDeviceLogic.name });
    }

    public async refreshData(
        device: VirtualDevice<PiperVirtualDeviceLogic>,
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
            this.logger.error('Piper process stdin is not writable.');
            this.stopPlayback();
            this.piperProcess = undefined;
        }
    }

    public override configureAttributes(): PiperVirtualDeviceAttributes {
        return {
            text: StrDeviceAttribute.create(
                PiperVirtualDeviceLogic.textAttrName,
                'Text',
                DeviceAttributeModifier.writeOnly,
            ),

            queuing: BoolDeviceAttribute.createInitialized(
                PiperVirtualDeviceLogic.queuingAttrName,
                'Queuing enabled',
                DeviceAttributeModifier.readWrite,
                false,
            ),
        };
    }

    public override async destroy(): Promise<void> {
        this.stopPlayback();

        if (this.piperProcess !== undefined) {
            this.piperProcess.stdin.destroy();
            this.piperProcess.kill();
            this.piperProcess = undefined;
        }

        return Promise.resolve();
    }

    private async startPiper(): Promise<void> {
        if (undefined !== this.piperProcess) {
            return;
        }

        try {
            const modelJson = await this.readModelJson(this.config.model);

            this.speakerOptions = this.createSpeakerOptionsFromModelMetadata(modelJson);

            const piperProcess = await spawnProcess(
                this.config.binary ?? 'piper',
                ['--model', this.config.model, '--output-raw'],
                {
                    env: { ...process.env, PIPER_NO_PLAYER: '1' },
                    stdio: ['pipe', 'pipe', 'pipe'],
                    detached: true,
                },
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

    private createSpeakerOptionsFromModelMetadata(metadata: PiperModelMetadata | undefined): Speaker.Options {
        let channels = 1;

        if (undefined === metadata?.num_speakers) {
            this.logger.warn(`Channels missing from piper model metadata file, falling back to ${channels}`);
        } else {
            channels = metadata.num_speakers;
        }

        let bitDepth = 16;

        if (undefined === metadata?.sample_width) {
            this.logger.warn(`Bit depth missing from piper model metadata file, falling back to ${bitDepth}`);
        } else {
            bitDepth = metadata.sample_width * BITS_PER_BYTE;
        }

        let sampleRate = 22050;

        if (undefined === metadata?.audio?.sample_rate) {
            this.logger.warn(`Sample rate from piper model metadata file, falling back to ${sampleRate}`);
        } else {
            sampleRate = metadata.audio.sample_rate
            ;
        }

        return {
            channels,
            bitDepth,
            sampleRate,
        };
    }

    private async readModelJson(modelFilePath: string): Promise<PiperModelMetadata | undefined> {
        const metadataFilePath = `${modelFilePath}.json`;

        try {
            const fileContent = await fs.promises.readFile(metadataFilePath, 'utf-8');
            const json: unknown = JSON.parse(fileContent);

            if (!Value.Check(PiperModelMetadataSchema, json)) {
                this.logger.warn(`Metadata file '${metadataFilePath}' has an unexpected shape. Ignoring it.`);
                return undefined;
            }

            this.logger.info(`Successfully read metadata for Piper model from '${metadataFilePath}'`);

            return json;
        } catch (e: unknown) {
            if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'ENOENT') {
                this.logger.warn(`Could not read Piper model metadata file '${metadataFilePath}'`);
                return undefined;
            }

            throw e;
        }
    }

    private startPlayback(): void {
        if (undefined === this.piperProcess || undefined !== this.speaker) {
            return;
        }

        this.logger.debug('New speaker started');

        this.speaker = new Speaker(this.speakerOptions);

        this.piperProcess.stdout.pipe(this.speaker);
    }

    private stopPlayback(): boolean {
        if (undefined === this.piperProcess || undefined === this.speaker) {
            return false;
        }

        this.piperProcess.stdout.unpipe();
        const devNull = new DevNullStream(PiperVirtualDeviceLogic.stdoutDrainIdleTimeoutMs);
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
}
