import {DeviceAttributeModifier} from "../../../attribute/deviceAttribute.js";
import StrDeviceAttribute from "../../../attribute/strDeviceAttribute.js";
import VirtualDeviceLogic from "../virtualDeviceLogic.js";
import say from 'say';
import VirtualDevice from "../virtualDevice.js";
import BoolDeviceAttribute from "../../../attribute/boolDeviceAttribute.js";
import IntDeviceAttribute from "../../../attribute/intDeviceAttribute.js";
import {Int} from "../../../../util/numbers.js";
import Logger from "../../../../logging/Logger.js";
import {TtsVirtualDeviceConfig} from "./ttsVirtualDeviceConfig.js";

type TtsVirtualDeviceAttributes = {
    text: StrDeviceAttribute;
    speaking: BoolDeviceAttribute;
    queuing: BoolDeviceAttribute;
    queueLength: IntDeviceAttribute;
}

export default class TtsVirtualDeviceLogic implements VirtualDeviceLogic<
    TtsVirtualDeviceAttributes,
    TtsVirtualDeviceConfig
> {
    private static readonly textAttrName: string = 'text';
    private static readonly speakingAttrName: string = 'speaking';
    private static readonly queuingAttrName: string = 'queuing';
    private static readonly queueLengthAttrName: string = 'queueLength';

    private ttsEntries: string[] = [];

    private readonly config: TtsVirtualDeviceConfig;

    private readonly logger: Logger;

    public constructor(config: TtsVirtualDeviceConfig, logger: Logger) {
        this.config = config;
        this.logger = logger.child({ name: TtsVirtualDeviceLogic.name });
    }

    public async refreshData(device: VirtualDevice<TtsVirtualDeviceAttributes, TtsVirtualDeviceConfig>): Promise<void> {
        const text = (await device.getAttribute('text'))?.value;
        const queuing = (await device.getAttribute('queuing'))?.value ?? false;
        const speaking = (await device.getAttribute('speaking'))?.value ?? false;

        if (undefined !== text) {
            if (false === queuing) {
                this.ttsEntries = [];
            }
            this.ttsEntries.push(text);
            await device.setAttribute('queueLength', Int.from(this.ttsEntries.length));
            await device.setAttribute('text', undefined);
        }

        if (0 === this.ttsEntries.length) {
            return;
        }

        if (false === queuing) {
            say.stop();
        } else if (true === speaking) {
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
                .catch((e: any) => this.logger.error('Could not set attribute "speaking" to false', e));
        });
        await device.setAttribute('queueLength', Int.from(this.ttsEntries.length));
    }

    public get refreshInterval(): number {
        return 50;
    }

    public configureAttributes(): TtsVirtualDeviceAttributes {
        const textAttr = StrDeviceAttribute.create(
            TtsVirtualDeviceLogic.textAttrName, 'Text', DeviceAttributeModifier.writeOnly
        );

        const speakingAttr = BoolDeviceAttribute.createInitialized(
            TtsVirtualDeviceLogic.speakingAttrName,
            'Currently speaking',
            DeviceAttributeModifier.readOnly,
            false
        );

        const queuingAttr = BoolDeviceAttribute.createInitialized(
            TtsVirtualDeviceLogic.queuingAttrName,
            'Queuing enabled',
            DeviceAttributeModifier.readWrite,
            false
        );

        const queueLengthAttr = IntDeviceAttribute.createInitialized(
            TtsVirtualDeviceLogic.queueLengthAttrName,
            'Queue length',
            DeviceAttributeModifier.readOnly,
            undefined,
            Int.ZERO
        );

        return {
            text: textAttr,
            speaking: speakingAttr,
            queuing: queuingAttr,
            queueLength: queueLengthAttr
        };
    }
}
