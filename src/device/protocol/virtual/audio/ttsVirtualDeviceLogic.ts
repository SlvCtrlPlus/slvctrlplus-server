import VirtualDeviceLogic from '../virtualDeviceLogic.js';
import type { VirtualDeviceSetup } from '../virtualDeviceLogic.js';
import say from 'say';
import type VirtualDevice from '../virtualDevice.js';
import type Logger from '../../../../logging/Logger.js';
import type { TtsVirtualDeviceConfig } from './ttsVirtualDeviceConfig.js';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { strProperty, boolProperty, intProperty } from '../../../attribute/attributeSchema.js';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const ttsAttributesSchema = () => Type.Object({
    text: Type.Optional(strProperty({ label: 'Text', writeOnly: true })),
    speaking: boolProperty({ label: 'Currently speaking', readOnly: true }),
    queuing: boolProperty({ label: 'Queuing enabled' }),
    queueLength: intProperty({ label: 'Queue length', readOnly: true }),
}, { additionalProperties: false });

type TtsDeviceData = Static<ReturnType<typeof ttsAttributesSchema>>;

export default class TtsVirtualDeviceLogic extends VirtualDeviceLogic<
    TtsDeviceData,
    TtsVirtualDeviceConfig
> {
    public readonly refreshInterval = 175;

    private ttsEntries: string[] = [];

    private readonly logger: Logger;

    public constructor(config: TtsVirtualDeviceConfig, logger: Logger) {
        super(config);
        this.logger = logger.child({ name: TtsVirtualDeviceLogic.name });
    }

    public async refreshData(device: VirtualDevice<TtsVirtualDeviceLogic>): Promise<void> {
        const deviceData = device.getDeviceData();
        const text = deviceData.text;
        const queuing = deviceData.queuing;
        const speaking = deviceData.speaking;

        if (undefined !== text) {
            if (!queuing) {
                this.ttsEntries = [];
            }
            this.ttsEntries.push(text);
            await device.updateDeviceData({ queueLength: this.ttsEntries.length });
            await device.updateDeviceData({ text: undefined });
        }

        if (0 === this.ttsEntries.length) {
            return;
        }

        if (!queuing) {
            say.stop();
        } else if (speaking) {
            return; // already speaking, so don't do anything
        }

        await device.updateDeviceData({ speaking: true });

        const voice = this.config.voice;
        const textToSpeak = this.ttsEntries.shift();

        if (undefined === textToSpeak) {
            await device.updateDeviceData({ queueLength: this.ttsEntries.length });
            return;
        }

        say.speak(textToSpeak, voice, 1, (err: string) => {
            if (err) {
                this.logger.error(`Could not speak text: ${err}`);
            }

            device.updateDeviceData({ speaking: false })
                .catch((e: unknown) => this.logger.error('Could not set attribute "speaking" to false', e));
        });
        await device.updateDeviceData({ queueLength: this.ttsEntries.length });
    }

    public override configureDevice(): VirtualDeviceSetup<TtsDeviceData> {
        return {
            schema: ttsAttributesSchema(),
            data: {
                speaking: false,
                queuing: false,
                queueLength: 0,
            },
        };
    }
}
