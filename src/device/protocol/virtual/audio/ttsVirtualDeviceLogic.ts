import GenericDeviceAttribute, {GenericDeviceAttributeModifier} from "../../../attribute/genericDeviceAttribute.js";
import StrGenericDeviceAttribute from "../../../attribute/strGenericDeviceAttribute.js";
import VirtualDeviceLogic from "../virtualDeviceLogic.js";
import say from 'say';
import VirtualDevice from "../virtualDevice";
import BoolGenericDeviceAttribute from "../../../attribute/boolGenericDeviceAttribute.js";
import IntGenericDeviceAttribute from "../../../attribute/intGenericDeviceAttribute.js";

type TtsVirtualDeviceAttributes = {
    text: StrGenericDeviceAttribute;
    speaking: BoolGenericDeviceAttribute;
    queuing: BoolGenericDeviceAttribute;
    queueLength: IntGenericDeviceAttribute;
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
        const text = (await device.getAttribute('text')).value;
        const queuing = (await device.getAttribute('queuing')).value;
        const speaking = (await device.getAttribute('speaking')).value;

        if (undefined !== text && null !== text) {
            if (false === queuing) {
                this.ttsEntries = [];
            }
            this.ttsEntries.push(text);
            await device.setAttribute('queueLength', this.ttsEntries.length);
            await device.setAttribute('text', null);
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

        say.speak(this.ttsEntries.shift(), voice, 1, (err) => {
            if (err) {
                return console.error(err);
            }

            void device.setAttribute('speaking', false);
        });
        await device.setAttribute('queueLength', this.ttsEntries.length);
    }

    public get getRefreshInterval(): number {
        return 50;
    }

    public configureAttributes(): TtsVirtualDeviceAttributes {
        const textAttr = new StrGenericDeviceAttribute();
        textAttr.name = TtsVirtualDeviceLogic.textAttrName;
        textAttr.modifier = GenericDeviceAttributeModifier.writeOnly;

        const speakingAttr = new BoolGenericDeviceAttribute();
        speakingAttr.name = TtsVirtualDeviceLogic.speakingAttrName;
        speakingAttr.modifier = GenericDeviceAttributeModifier.readOnly;

        const queuingAttr = new BoolGenericDeviceAttribute();
        queuingAttr.name = TtsVirtualDeviceLogic.queuingAttrName;
        queuingAttr.modifier = GenericDeviceAttributeModifier.readWrite;

        const queueLengthAttr = new IntGenericDeviceAttribute();
        queueLengthAttr.name = TtsVirtualDeviceLogic.queueLengthAttrName;
        queueLengthAttr.modifier = GenericDeviceAttributeModifier.readOnly;

        return {
            text: textAttr,
            speaking: speakingAttr,
            queuing: queuingAttr,
            queueLength: queueLengthAttr
        };
    }
}
