import { DeviceAttributeModifier } from '../../../attribute/deviceAttribute.js';
import StrDeviceAttribute from '../../../attribute/strDeviceAttribute.js';
import type { Nullable } from '../../../attribute/deviceAttribute.js';
import VirtualDeviceLogic from '../virtualDeviceLogic.js';
import say from 'say';
import type VirtualDevice from '../virtualDevice.js';
import BoolDeviceAttribute from '../../../attribute/boolDeviceAttribute.js';
import IntDeviceAttribute from '../../../attribute/intDeviceAttribute.js';
import { Int } from '../../../../util/numbers.js';
import type Logger from '../../../../logging/Logger.js';
import type { TtsVirtualDeviceConfig } from './ttsVirtualDeviceConfig.js';

type TtsVirtualDeviceAttributes = {
    text: StrDeviceAttribute<Nullable>;
    speaking: BoolDeviceAttribute;
    queuing: BoolDeviceAttribute;
    queueLength: IntDeviceAttribute;
};

export default class TtsVirtualDeviceLogic extends VirtualDeviceLogic<
    TtsVirtualDeviceAttributes,
    TtsVirtualDeviceConfig
> {
    private static readonly textAttrName: string = 'text';
    private static readonly speakingAttrName: string = 'speaking';
    private static readonly queuingAttrName: string = 'queuing';
    private static readonly queueLengthAttrName: string = 'queueLength';

    public readonly refreshInterval = 175;

    private ttsEntries: string[] = [];

    private readonly logger: Logger;

    public constructor(config: TtsVirtualDeviceConfig, logger: Logger) {
        super(config);
        this.logger = logger.child({ name: TtsVirtualDeviceLogic.name });
    }

    public async refreshData(device: VirtualDevice<TtsVirtualDeviceLogic>): Promise<void> {
        const text = (await device.getAttribute('text'))?.value;
        const queuing = (await device.getAttribute('queuing'))?.value ?? false;
        const speaking = (await device.getAttribute('speaking'))?.value ?? false;

        if (null !== text && undefined !== text) {
            if (!queuing) {
                this.ttsEntries = [];
            }
            this.ttsEntries.push(text);
            await device.setAttribute('queueLength', Int.from(this.ttsEntries.length));
            await device.setAttribute('text', null);
        }

        if (0 === this.ttsEntries.length) {
            return;
        }

        if (!queuing) {
            say.stop();
        } else if (speaking) {
            return; // already speaking, so don't do anything
        }

        await device.setAttribute('speaking', true);

        const voice = this.config.voice;
        const textToSpeak = this.ttsEntries.shift();

        if (undefined === textToSpeak) {
            await device.setAttribute('queueLength', Int.from(this.ttsEntries.length));
            return;
        }

        say.speak(textToSpeak, voice, 1, (err: string) => {
            if (err) {
                this.logger.error(`Could not speak text: ${err}`);
            }

            device.setAttribute('speaking', false)
                .catch((e: unknown) => this.logger.error('Could not set attribute "speaking" to false', e));
        });
        await device.setAttribute('queueLength', Int.from(this.ttsEntries.length));
    }

    public override configureAttributes(): TtsVirtualDeviceAttributes {
        const textAttr = StrDeviceAttribute.create({
            name: TtsVirtualDeviceLogic.textAttrName, label: 'Text', modifier: DeviceAttributeModifier.writeOnly,
            nullable: true, initialValue: null,
        });

        const speakingAttr = BoolDeviceAttribute.create({
            name: TtsVirtualDeviceLogic.speakingAttrName,
            label: 'Currently speaking',
            modifier: DeviceAttributeModifier.readOnly,
            initialValue: false,
        });

        const queuingAttr = BoolDeviceAttribute.create({
            name: TtsVirtualDeviceLogic.queuingAttrName,
            label: 'Queuing enabled',
            modifier: DeviceAttributeModifier.readWrite,
            initialValue: false,
        });

        const queueLengthAttr = IntDeviceAttribute.create({
            name: TtsVirtualDeviceLogic.queueLengthAttrName,
            label: 'Queue length',
            modifier: DeviceAttributeModifier.readOnly,
            initialValue: Int.ZERO,
        });

        return {
            text: textAttr,
            speaking: speakingAttr,
            queuing: queuingAttr,
            queueLength: queueLengthAttr,
        };
    }
}
