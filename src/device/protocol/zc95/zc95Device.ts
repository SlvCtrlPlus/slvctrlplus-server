import {Exclude} from "class-transformer";
import Device from "../../device.js";
import {
    MenuItem,
    MinMaxMenuItem,
    MsgResponse,
    MultiChoiceMenuItem,
    PowerStatusMsgResponse,
    Zc95Messages
} from "./Zc95Messages.js";
import RangeGenericDeviceAttribute from "../../attribute/rangeGenericDeviceAttribute.js";
import ListGenericDeviceAttribute from "../../attribute/listGenericDeviceAttribute.js";
import BoolGenericDeviceAttribute from "../../attribute/boolGenericDeviceAttribute.js";
import {GenericDeviceAttributeModifier} from "../../attribute/genericDeviceAttribute";

type RequiredZc95DeviceAttributes = {
    activePattern: ListGenericDeviceAttribute<number, string>;
    patternStarted: BoolGenericDeviceAttribute;
};

type Zc95DevicePowerChannelAttributes = {
    powerChannel1: RangeGenericDeviceAttribute;
    powerChannel2: RangeGenericDeviceAttribute;
    powerChannel3: RangeGenericDeviceAttribute;
    powerChannel4: RangeGenericDeviceAttribute;
}

type Zc95DevicePatternAttributes = {
    [key: `patternAttribute${number}`]: RangeGenericDeviceAttribute|ListGenericDeviceAttribute<number, string>;
}

export type Zc95DeviceAttributes = Partial<Zc95DevicePowerChannelAttributes & Zc95DevicePatternAttributes>
    & Required<RequiredZc95DeviceAttributes>;

type PowerChannelAttributeKey = Extract<keyof Zc95DeviceAttributes, `powerChannel${number}`>;
type PatternAttributeKey = Extract<keyof Zc95DeviceAttributes, `patternAttribute${number}`>;

@Exclude()
export default class Zc95Device extends Device<Zc95DeviceAttributes>
{
    private static readonly patternAttributePrefix = 'patternAttribute';

    private static readonly powerChannelAttributePrefix = 'powerChannel';

    private static readonly patternDetailAttributeRegex = new RegExp(`^${Zc95Device.patternAttributePrefix}(\\d+)$`);

    private static readonly powerChannelAttributeRegex = new RegExp(`^${Zc95Device.powerChannelAttributePrefix}([1-4])$`);

    protected readonly transport: Zc95Messages;

    protected readonly receiveQueue: MsgResponse[];

    public constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        transport: Zc95Messages,
        controllable: boolean,
        attributes: Zc95DeviceAttributes,
        receiveQueue: MsgResponse[]
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes);
        this.transport = transport;
        this.receiveQueue = receiveQueue;
    }

    public async refreshData(): Promise<void> {
        await this.processQueuedMessages();
    }

    public async setAttribute<K extends keyof Zc95DeviceAttributes>(attributeName: K, value: Zc95DeviceAttributes[K]['value']): Promise<Zc95DeviceAttributes[K]['value']> {
        if (attributeName === 'activePattern') {
            await this.setAttributeActivePattern(value as number);
            return value;
        }

        if (attributeName === 'patternStarted') {
            await this.setAttributePatternStarted(value as boolean);
            return value;
        }

        if (this.isPowerChannelAttribute(attributeName)) {
            await this.setAttributePowerChannel(attributeName, value as number);
            return value;
        }

        const patternDetailAttrMatch = Zc95Device.patternDetailAttributeRegex.exec(attributeName as string);

        if (patternDetailAttrMatch) {
            await this.setAttributePatternDetail(patternDetailAttrMatch, value as number);
            return value;
        }

        throw new Error(`Could not set attribute ${attributeName} with value ${value.toString()}`);
    }

    private async setAttributePatternDetail(attributeNameMatch: RegExpExecArray, value: number): Promise<void> {
        const attributeName = attributeNameMatch[0] as PatternAttributeKey;
        const patternDetailAttr = this.getAttribute(attributeName);
        const menuItemId = parseInt(attributeNameMatch[1], 10);

        if (patternDetailAttr instanceof RangeGenericDeviceAttribute) {
            await this.transport.patternMinMaxChange(menuItemId, value);
        } else if (patternDetailAttr instanceof ListGenericDeviceAttribute) {
            await this.transport.patternMultiChoiceChange(menuItemId, value);
        } else {
            throw new Error(`Unknown type for pattern detail attribute ${attributeName}`);
        }

        patternDetailAttr.value = value;
    }

    private async setAttributePowerChannel(
        attributeName: PowerChannelAttributeKey,
        value: number
    ): Promise<void> {
        const tmpData = {
            powerChannel1: this.attributes.powerChannel1.value,
            powerChannel2: this.attributes.powerChannel2.value,
            powerChannel3: this.attributes.powerChannel3.value,
            powerChannel4: this.attributes.powerChannel4.value,
        };

        tmpData[attributeName] = value;

        await this.transport.setPower(
            tmpData.powerChannel1 * 10,
            tmpData.powerChannel2 * 10,
            tmpData.powerChannel3 * 10,
            tmpData.powerChannel4 * 10,
        );

        this.attributes[attributeName].value = value;
    }

    private async setAttributeActivePattern(
        value: number
    ): Promise<void> {
        if (this.attributes.activePattern.value === value) {
            return;
        }

        if (this.attributes.patternStarted.value) {
            await this.setAttributePatternStarted(false);
        }

        this.attributes.activePattern.value = value;
    }

    private async setAttributePatternStarted(value: boolean): Promise<void> {
        if (this.attributes.patternStarted.value === value) {
            return;
        }

        if (value) {
            const patternDetails = await this.transport.getPatternDetails(this.attributes.activePattern.value);
            const patternAttributes = this.getAttributesFromPatternDetails(patternDetails.MenuItems);

            Object.assign(this.attributes, this.getChannelPowerAttributes(), patternAttributes);

            await this.transport.patternStart(this.attributes.activePattern.value);
        } else {
            await this.transport.patternStop();
            this.removePatternAttributesAndData();
        }

        this.attributes.patternStarted.value = value;
    }

    private getChannelPowerAttributes(): Zc95DevicePowerChannelAttributes
    {
        const attrs = {} as Zc95DevicePowerChannelAttributes;

        for (let i = 1; i <= 4; i++) {
            const powerChannelAttr = new RangeGenericDeviceAttribute();
            powerChannelAttr.name = `${Zc95Device.powerChannelAttributePrefix}${i}`;
            powerChannelAttr.label = `Channel ${i}`;
            powerChannelAttr.min = 0;
            powerChannelAttr.max = 0;
            powerChannelAttr.modifier = GenericDeviceAttributeModifier.readWrite;

            attrs[powerChannelAttr.name as PowerChannelAttributeKey] = powerChannelAttr;
        }

        return attrs;
    }

    private removePatternAttributesAndData(): void {
        this.getTypedKeys(this.attributes).forEach(key  => {
            if (
                key.startsWith(Zc95Device.patternAttributePrefix) ||
                key.startsWith(Zc95Device.powerChannelAttributePrefix)
            ) {
                delete this.attributes[key];
            }
        });
    }

    private processQueuedMessages(): Promise<void> {
        return new Promise((resolve) => {
            let queueMessagesProcessed = 0;

            while (this.receiveQueue.length > 0 && queueMessagesProcessed <= 10) {
                const msg = this.receiveQueue.shift();
                ++queueMessagesProcessed;

                if (!this.isPowerStatusMessage(msg)) {
                    continue;
                }

                for (const channel of msg.Channels) {
                    const channelAttrName = `powerChannel${channel.Channel}` as PowerChannelAttributeKey;
                    const channelAttr = this.attributes[channelAttrName];
                    const percentagePowerLimit = Math.floor(channel.PowerLimit * 0.1);

                    if (!channelAttr) {
                        continue;
                    }

                    if (this.attributes[channelAttrName].value > percentagePowerLimit) {
                        this.attributes[channelAttrName].value = percentagePowerLimit;
                    }

                    channelAttr.max = percentagePowerLimit;
                }
            }

            resolve();
        });
    }

    private getAttributesFromPatternDetails(
        menuItems: (MinMaxMenuItem|MultiChoiceMenuItem)[]
    ): Zc95DevicePatternAttributes {
        const patternAttributes = {} as Zc95DevicePatternAttributes;

        for (const menuItem of menuItems) {
            const attrName = `${Zc95Device.patternAttributePrefix}${menuItem.Id}`;

            if (this.isMinMaxMenuItem(menuItem)) {
                const rangeAttr = new RangeGenericDeviceAttribute();
                rangeAttr.name = attrName;
                rangeAttr.label = menuItem.Title;
                rangeAttr.min = menuItem.Min;
                rangeAttr.max = menuItem.Max;
                rangeAttr.incrementStep = menuItem.IncrementStep;
                rangeAttr.uom = menuItem.UoM;
                rangeAttr.modifier = GenericDeviceAttributeModifier.readWrite;
                patternAttributes[attrName as PatternAttributeKey] = rangeAttr;
            } else if (this.isMultiChoiceMenuItem(menuItem)) {
                const listAttr = new ListGenericDeviceAttribute<number, string>();
                listAttr.name = attrName;
                listAttr.label = menuItem.Title;
                listAttr.values = new Map(menuItem.Choices.map((choice) => [choice.Id, choice.Name]));
                listAttr.modifier = GenericDeviceAttributeModifier.readWrite;

                patternAttributes[attrName as PatternAttributeKey] = listAttr;
            }

            patternAttributes[`${Zc95Device.patternAttributePrefix}${menuItem.Id}`].value = menuItem.Default;
        }

        return patternAttributes;
    }

    private isPowerChannelAttribute(
        attributeName: keyof Zc95DeviceAttributes
    ): attributeName is PowerChannelAttributeKey {
        return Zc95Device.powerChannelAttributeRegex.test(attributeName);
    }

    private isPowerStatusMessage(msg: MsgResponse): msg is PowerStatusMsgResponse {
        return msg.Type === 'PowerStatus';
    }

    private isMinMaxMenuItem(menuItem: MenuItem): menuItem is MinMaxMenuItem {
        return menuItem.Type === 'MIN_MAX';
    }

    private isMultiChoiceMenuItem(menuItem: MenuItem): menuItem is MultiChoiceMenuItem {
        return menuItem.Type === 'MULTI_CHOICE';
    }

    private getTypedKeys<T extends object>(obj: T): (keyof T)[] {
        return Object.keys(obj) as (keyof T)[];
    }
}
