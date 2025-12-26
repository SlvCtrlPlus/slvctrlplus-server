import {Exclude} from "class-transformer";
import Device, {AttributeValue} from "../../device.js";
import {
    MenuItem,
    MinMaxMenuItem,
    MsgResponse,
    MultiChoiceMenuItem,
    PowerStatusMsgResponse,
    Zc95Messages
} from "./Zc95Messages.js";
import IntRangeDeviceAttribute, {InitializedIntRangeDeviceAttribute} from "../../attribute/intRangeDeviceAttribute.js";
import ListDeviceAttribute, {InitializedListDeviceAttribute} from "../../attribute/listDeviceAttribute.js";
import {InitializedBoolDeviceAttribute} from "../../attribute/boolDeviceAttribute.js";
import {DeviceAttributeModifier} from "../../attribute/deviceAttribute.js";
import {Int} from "../../../util/numbers.js";
import {getTypedKeys} from "../../../util/objects.js";

type RequiredZc95DeviceAttributes = {
    activePattern: InitializedListDeviceAttribute<Int, string>;
    patternStarted: InitializedBoolDeviceAttribute;
};

type Zc95DevicePowerChannelAttributes = {
    powerChannel1: IntRangeDeviceAttribute;
    powerChannel2: IntRangeDeviceAttribute;
    powerChannel3: IntRangeDeviceAttribute;
    powerChannel4: IntRangeDeviceAttribute;
}

type Zc95DevicePatternAttributes = {
    [key: `patternAttribute${number}`]: InitializedIntRangeDeviceAttribute|ListDeviceAttribute<Int, string>;
}

export type Zc95DeviceAttributes = Partial<Zc95DevicePowerChannelAttributes & Zc95DevicePatternAttributes>
    & Required<RequiredZc95DeviceAttributes>;

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

    public async setAttribute<K extends keyof Zc95DeviceAttributes, V extends AttributeValue<Zc95DeviceAttributes[K]>>(attributeName: K, value: V): Promise<V> {
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

        throw new Error(`Could not set attribute ${attributeName} with value ${JSON.stringify(value)}`);
    }

    private async setAttributePatternDetail(attributeNameMatch: RegExpExecArray, value: number): Promise<void> {
        const attributeName = attributeNameMatch[0] as keyof Zc95DevicePatternAttributes;
        const patternDetailAttr = this.getAttribute(attributeName);
        const menuItemId = parseInt(attributeNameMatch[1], 10);

        if (IntRangeDeviceAttribute.isInstance(patternDetailAttr) && patternDetailAttr.isValidValue(value)) {
            await this.transport.patternMinMaxChange(menuItemId, value);
            patternDetailAttr.value = value;
        } else if (ListDeviceAttribute.isInstance(patternDetailAttr) && patternDetailAttr.isValidValue(value)) {
            await this.transport.patternMultiChoiceChange(menuItemId, value);
            patternDetailAttr.value = value;
        } else {
            throw new Error(`Unknown type for pattern detail attribute ${attributeName}`);
        }
    }

    private async setAttributePowerChannel(
        attributeName: keyof Zc95DevicePowerChannelAttributes,
        value: number
    ): Promise<void> {
        if (!this.allPowerChannelValuesDefined(this.attributes)) {
            return;
        }

        const tmpData = {
            powerChannel1: this.attributes.powerChannel1.value,
            powerChannel2: this.attributes.powerChannel2.value,
            powerChannel3: this.attributes.powerChannel3.value,
            powerChannel4: this.attributes.powerChannel4.value,
        };

        tmpData[attributeName] = Int.from(value);

        await this.transport.setPower(
            tmpData.powerChannel1 * 10,
            tmpData.powerChannel2 * 10,
            tmpData.powerChannel3 * 10,
            tmpData.powerChannel4 * 10,
        );

        this.attributes[attributeName].value = Int.from(value);
    }

    private allPowerChannelValuesDefined(attrs: Partial<Zc95DevicePowerChannelAttributes>): attrs is {
        [K in keyof Zc95DevicePowerChannelAttributes]-?: InitializedIntRangeDeviceAttribute
    } {
        return attrs.powerChannel1?.value !== undefined &&
            attrs.powerChannel2?.value !== undefined &&
            attrs.powerChannel3?.value !== undefined &&
            attrs.powerChannel4?.value !== undefined;
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

        this.attributes.activePattern.value = Int.from(value);
    }

    private async setAttributePatternStarted(value: boolean): Promise<void> {
        if (this.attributes.patternStarted.value === value) {
            return;
        }

        if (value) {
            const patternDetails = await this.transport.getPatternDetails(this.attributes.activePattern.value);

            if (undefined !== patternDetails) {
                const patternAttributes = this.getAttributesFromPatternDetails(patternDetails.MenuItems);

                Object.assign(this.attributes, this.getChannelPowerAttributes(), patternAttributes);
            }

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
            const powerChannelAttr = IntRangeDeviceAttribute.create(
                `${Zc95Device.powerChannelAttributePrefix}${i}`,
                `Channel ${i}`,
                DeviceAttributeModifier.readWrite,
                undefined,
                Int.ZERO,
                Int.ZERO,
                Int.from(1),
            );

            attrs[powerChannelAttr.name as keyof Zc95DevicePowerChannelAttributes] = powerChannelAttr;
        }

        return attrs;
    }

    private removePatternAttributesAndData(): void {
        getTypedKeys(this.attributes).forEach(key  => {
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

                if (undefined === msg || !this.isPowerStatusMessage(msg)) {
                    continue;
                }

                for (const channel of msg.Channels) {
                    const channelAttrName = `powerChannel${channel.Channel}` as keyof Zc95DevicePowerChannelAttributes;
                    const channelAttr = this.attributes[channelAttrName];
                    const percentagePowerLimit = Int.from(Math.floor(channel.PowerLimit * 0.1));

                    if (!channelAttr) {
                        continue;
                    }

                    if (undefined !== this.attributes[channelAttrName]?.value &&
                        this.attributes[channelAttrName].value > percentagePowerLimit
                    ) {
                        this.attributes[channelAttrName].value = percentagePowerLimit;
                    }

                    channelAttr.value = Int.from(Math.floor(channel.MaxOutputPower * 0.1)) // or channel.OutputPower?
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
                patternAttributes[attrName as keyof Zc95DevicePatternAttributes] = IntRangeDeviceAttribute.createInitialized(
                    attrName,
                    menuItem.Title,
                    DeviceAttributeModifier.readWrite,
                    menuItem.UoM,
                    Int.from(menuItem.Min),
                    Int.from(menuItem.Max),
                    Int.from(menuItem.IncrementStep),
                    Int.from(menuItem.Default),
                );
            } else if (this.isMultiChoiceMenuItem(menuItem)) {
                patternAttributes[attrName as keyof Zc95DevicePatternAttributes] = ListDeviceAttribute.createInitialized<Int, string>(
                    attrName,
                    menuItem.Title,
                    DeviceAttributeModifier.readWrite,
                    new Map(menuItem.Choices.map((choice) => [Int.from(choice.Id), choice.Name])),
                    Int.from(menuItem.Default),
                );
            }

            patternAttributes[`${Zc95Device.patternAttributePrefix}${menuItem.Id}`].value = Int.from(menuItem.Default);
        }

        return patternAttributes;
    }

    private isPowerChannelAttribute(
        attributeName: keyof Zc95DeviceAttributes
    ): attributeName is keyof Zc95DevicePowerChannelAttributes {
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
}
