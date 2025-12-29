import {DeviceAttributeModifier} from "../../../attribute/deviceAttribute.js";
import StrDeviceAttribute from "../../../attribute/strDeviceAttribute.js";
import VirtualDeviceLogic from "../virtualDeviceLogic.js";
import say from 'say';
import VirtualDevice from "../virtualDevice.js";
import BoolDeviceAttribute from "../../../attribute/boolDeviceAttribute.js";
import IntDeviceAttribute from "../../../attribute/intDeviceAttribute.js";
import {Int} from "../../../../util/numbers.js";
import {JsonObject} from "../../../../types.js";

type TtsVirtualDeviceAttributes = {
    text: StrDeviceAttribute;
    speaking: BoolDeviceAttribute;
    queuing: BoolDeviceAttribute;
    queueLength: IntDeviceAttribute;
}

export default class TtsVirtualDeviceLogic implements VirtualDeviceLogic<TtsVirtualDeviceAttributes> {

    private static readonly textAttrName: string = 'text';
    private static readonly speakingAttrName: string = 'speaking';
    private static readonly queuingAttrName: string = 'queuing';
    private static readonly queueLengthAttrName: string = 'queueLength';

    private ttsEntries: string[] = [];

    private config: JsonObject;

    public constructor(config: JsonObject) {
        this.config = config;
    }

    public async refreshData(device: VirtualDevice<TtsVirtualDeviceAttributes>): Promise<void> {
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

        const voice = this.config.voice as string | undefined;
        const textToSpeak = this.ttsEntries.shift();

        if (undefined === textToSpeak) {
            await device.setAttribute('queueLength', Int.from(this.ttsEntries.length));
            return;
        }

        say.speak(textToSpeak, voice, 1, (err) => {
            if (err) {
                return console.error(err);
            }

            void device.setAttribute('speaking', false);
        });
        await device.setAttribute('queueLength', Int.from(this.ttsEntries.length));
    }

    public get getRefreshInterval(): number {
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
