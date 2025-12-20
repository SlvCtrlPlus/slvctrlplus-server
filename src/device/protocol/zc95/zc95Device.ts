import {Exclude} from "class-transformer";
import Device from "../../device.js";
import GenericDeviceAttribute, {GenericDeviceAttributeModifier} from "../../attribute/genericDeviceAttribute.js";
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

type Zc95DeviceData = {
    activePattern: number;
    patternStarted: boolean;
    powerChannel1: number;
    powerChannel2: number;
    powerChannel3: number;
    powerChannel4: number;
    [key: `patternAttribute${number}`]: number;
}

@Exclude()
export default class Zc95Device extends Device<Zc95DeviceData>
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
        attributes: GenericDeviceAttribute[],
        receiveQueue: MsgResponse[]
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes);
        this.transport = transport;
        this.receiveQueue = receiveQueue;
    }

    public async refreshData(): Promise<void> {
        await this.initializeData();
        this.processQueuedMessages();
    }

    public async setAttribute<K extends keyof Zc95DeviceData>(attributeName: K, value: Zc95DeviceData[K]): Promise<Zc95DeviceData[K]> {
        if (attributeName === 'activePattern') {
            await this.setAttributeActivePattern(value as number);
            return value;
        }

        if (attributeName === 'patternStarted') {
            await this.setAttributePatternStarted(attributeName, value as boolean);
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
        const attributeName = attributeNameMatch[0] as Extract<keyof Zc95DeviceData, `patternAttribute${number}`>;
        const patternDetailAttr = this.getAttributeDefinition(attributeName);
        const menuItemId = parseInt(attributeNameMatch[1], 10);

        if (patternDetailAttr instanceof RangeGenericDeviceAttribute) {
            await this.transport.patternMinMaxChange(menuItemId, value);
        } else if (patternDetailAttr instanceof ListGenericDeviceAttribute) {
            await this.transport.patternMultiChoiceChange(menuItemId, value);
        } else {
            throw new Error(`Unknown type for pattern detail attribute ${attributeName}`);
        }

        this.data[attributeName] = value;
    }

    private async setAttributePowerChannel(
        attributeName: Extract<keyof Zc95DeviceData, `powerChannel${number}`>,
        value: number
    ): Promise<void> {
        const tmpData = { ...this.data };

        tmpData[attributeName] = value;

        await this.transport.setPower(
            tmpData.powerChannel1 * 10,
            tmpData.powerChannel2 * 10,
            tmpData.powerChannel3 * 10,
            tmpData.powerChannel4 * 10,
        );

        this.data[attributeName] = value;
    }

    private async setAttributeActivePattern(
        value: number
    ): Promise<void> {
        if (this.data.activePattern === value) {
            return;
        }

        if (this.data.patternStarted) {
            await this.setAttributePatternStarted('patternStarted', false);
        }

        this.data.activePattern = value;
    }

    private async setAttributePatternStarted(
        attributeName: Extract<keyof Zc95DeviceData, `patternStarted`>,
        value: boolean
    ): Promise<void> {
        if (this.data.patternStarted === value) {
            return;
        }

        if (value) {
            const patternDetails = await this.transport.getPatternDetails(this.data.activePattern);
            const [patternAttributes, patternDeviceData] = this.getAttributesFromPatternDetails(patternDetails.MenuItems);

            this.attributes.push(...this.getChannelPowerAttributes());
            this.attributes.push(...patternAttributes);

            Object.assign(this.data, patternDeviceData);

            await this.transport.patternStart(this.data.activePattern);
        } else {
            await this.transport.patternStop();
            this.removePatternAttributesAndData();
        }

        this.data[attributeName] = value;
    }

    private getChannelPowerAttributes()
    {
        const attrs = [];

        for (let i = 1; i <= 4; i++) {
            const powerChannelAttr = new RangeGenericDeviceAttribute();
            powerChannelAttr.name = `${Zc95Device.powerChannelAttributePrefix}${i}`;
            powerChannelAttr.label = `Channel ${i}`;
            powerChannelAttr.min = 0;
            powerChannelAttr.max = 0;
            powerChannelAttr.modifier = GenericDeviceAttributeModifier.readWrite;

            attrs.push(powerChannelAttr);
        }

        return attrs;
    }

    private async initializeData(): Promise<void> {
        if (Object.keys(this.data).length > 0) {
            return;
        }

        const defaultPattern = 0;

        this.data = {
            activePattern: defaultPattern,
            patternStarted: false,
            powerChannel1: 0,
            powerChannel2: 0,
            powerChannel3: 0,
            powerChannel4: 0,
        };

        await this.setAttributeActivePattern(defaultPattern);
    }

    private removePatternAttributesAndData(): void {
        for (let i = this.attributes.length - 1; i >= 0; i--) {
            if (
                this.attributes[i].name.startsWith(Zc95Device.patternAttributePrefix) ||
                this.attributes[i].name.startsWith(Zc95Device.powerChannelAttributePrefix)
            ) {
                this.attributes.splice(i, 1);
            }
        }

        Object.keys(this.data).forEach(key => {
            if (key.startsWith(Zc95Device.patternAttributePrefix)) {
                delete this.data[key as keyof Zc95DeviceData];
            }
        });
    }

    private processQueuedMessages(): void {
        let queueMessagesProcessed = 0;

        while(this.receiveQueue.length > 0 && queueMessagesProcessed <= 10) {
            const msg = this.receiveQueue.shift();
            ++queueMessagesProcessed;

            if (this.isPowerStatusMessage(msg)) {
                for (const channel of msg.Channels) {
                    const channelAttrName = `powerChannel${channel.Channel}` as Extract<keyof Zc95DeviceData, `powerChannel${number}`>;
                    const channelAttr = this.getAttributeDefinition(channelAttrName) as RangeGenericDeviceAttribute;
                    const percentagePowerLimit = Math.floor(channel.PowerLimit * 0.1);

                    if (!channelAttr) {
                        continue;
                    }

                    if (this.data[channelAttrName] > percentagePowerLimit) {
                        this.data[channelAttrName] = percentagePowerLimit;
                    }

                    channelAttr.max = percentagePowerLimit;
                }
            }
        }
    }

    private getAttributesFromPatternDetails(
        menuItems: (MinMaxMenuItem|MultiChoiceMenuItem)[]
    ): [GenericDeviceAttribute[], Partial<Zc95DeviceData>] {
        const patternAttributes: GenericDeviceAttribute[] = [];
        const patternDeviceData = {} as Partial<Zc95DeviceData>;

        for (const menuItem of menuItems) {
            if (this.isMinMaxMenuItem(menuItem)) {
                const rangeAttr = new RangeGenericDeviceAttribute();
                rangeAttr.name = `${Zc95Device.patternAttributePrefix}${menuItem.Id}`;
                rangeAttr.label = menuItem.Title;
                rangeAttr.min = menuItem.Min;
                rangeAttr.max = menuItem.Max;
                rangeAttr.incrementStep = menuItem.IncrementStep;
                rangeAttr.uom = menuItem.UoM;
                rangeAttr.modifier = GenericDeviceAttributeModifier.readWrite;
                patternAttributes.push(rangeAttr)
            } else if (this.isMultiChoiceMenuItem(menuItem)) {
                const listAttr = new ListGenericDeviceAttribute();
                listAttr.name = `${Zc95Device.patternAttributePrefix}${menuItem.Id}`;
                listAttr.label = menuItem.Title;
                listAttr.values = new Map(menuItem.Choices.map((choice) => [choice.Id, choice.Name]));
                listAttr.modifier = GenericDeviceAttributeModifier.readWrite;

                patternAttributes.push(listAttr);
            }

            patternDeviceData[`${Zc95Device.patternAttributePrefix}${menuItem.Id}`] = menuItem.Default;
        }

        return [patternAttributes, patternDeviceData];
    }

    private isPowerChannelAttribute(
        attributeName: keyof Zc95DeviceData
    ): attributeName is Extract<keyof Zc95DeviceData, `powerChannel${number}`> {
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
