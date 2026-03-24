import { Exclude, Expose } from 'class-transformer';
import { AttributeValue } from '../../device.js';
import Zc95MessageFactory, {
    MenuItem,
    MinMaxMenuItem,
    MsgResponse,
    MultiChoiceMenuItem,
    PowerStatusMsgResponse,
} from './zc95MessageFactory.js';
import IntRangeDeviceAttribute, {
    InitializedIntRangeDeviceAttribute
} from '../../attribute/intRangeDeviceAttribute.js';
import ListDeviceAttribute, { InitializedListDeviceAttribute } from '../../attribute/listDeviceAttribute.js';
import { InitializedBoolDeviceAttribute } from '../../attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import { getTypedKeys } from '../../../util/objects.js';
import typeDetect from 'type-detect';
import { AllOrNone } from '../../../types.js';
import { NoDeviceConfig } from '../../deviceConfig.js';
import PeripheralDevice from '../../peripheralDevice.js';
import Zc95Protocol from './zc95Protocol.js';
import DeviceTransport from '../../transport/deviceTransport.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import Logger from '../../../logging/Logger.js';
import EventEmitter from 'events';
import { DeviceId } from '../../deviceId.js';

type RequiredZc95DeviceAttributes = {
    activePattern: InitializedListDeviceAttribute<Int, string>;
    patternStarted: InitializedBoolDeviceAttribute;
};

type Zc95DevicePowerChannelAttributesKeyPrefix = `powerChannel`;
type Zc95DevicePowerChannelAttributesKey = `${Zc95DevicePowerChannelAttributesKeyPrefix}${1 | 2 | 3 | 4}`;

type Zc95DevicePowerChannelAttributes = {
    [K in Zc95DevicePowerChannelAttributesKey]: IntRangeDeviceAttribute;
}

type Zc95DevicePatternAttributesKeyPrefix = `patternAttribute`;
type Zc95DevicePatternAttributesKey = `${Zc95DevicePatternAttributesKeyPrefix}${number}`;

type Zc95DevicePatternAttributes = {
    [key in Zc95DevicePatternAttributesKey]: InitializedIntRangeDeviceAttribute | ListDeviceAttribute<Int, string>;
}

export type Zc95DeviceAttributes = Partial<AllOrNone<Zc95DevicePowerChannelAttributes> & Zc95DevicePatternAttributes>
    & Required<RequiredZc95DeviceAttributes>;

type AnyZc95DeviceAttribute = Zc95DeviceAttributes[keyof Zc95DeviceAttributes];

@Exclude()
export default class Zc95Device extends PeripheralDevice<Zc95Protocol, Zc95DeviceAttributes>
{
    private static readonly patternAttributePrefix = 'patternAttribute';

    private static readonly powerChannelAttributePrefix = 'powerChannel';

    @Expose()
    private readonly fwVersion: string;

    private msgFactory: Zc95MessageFactory;

    private readonly messageResponseHandler: MessageResponseHandler<Zc95Protocol>;

    private logger: Logger;

    public constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        fwVersion: string,
        protocol: Zc95Protocol,
        transport: DeviceTransport,
        controllable: boolean,
        attributes: Zc95DeviceAttributes,
        config: NoDeviceConfig,
        msgFactory: Zc95MessageFactory,
        messageResponseHandler: MessageResponseHandler<Zc95Protocol>,
        eventEmitter: EventEmitter,
        logger: Logger
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, protocol, transport, attributes, config, eventEmitter);
        this.fwVersion = fwVersion;
        this.msgFactory = msgFactory;

        this.transport.onReceive(data => this.onReceivedMessage(data));
        this.messageResponseHandler = messageResponseHandler;
        this.logger = logger.child({ name: `${Zc95Device.name}.${transport.getDeviceIdentifier()}` });
    }

    public async setAttribute<
        K extends keyof Zc95DeviceAttributes & string
    >(attributeName: K, value: AttributeValue<K>): Promise<AttributeValue<K>> {
        const attribute = this.attributes[attributeName];

        if (undefined === attribute) {
            throw new Error(`Attribute with name '${attributeName}' does not exist for this device`)
        }

        if (this.isActivePatternAttribute(attribute) && attribute.isValidValue(value)) {
            await this.setAttributeActivePattern(value);
            this.updateLastRefresh();
            return attribute.value;
        }

        if (this.isPatternStartedAttribute(attribute) && attribute.isValidValue(value)) {
            await this.setAttributePatternStarted(value);
            this.updateLastRefresh();
            return attribute.value;
        }

        if (this.isPowerChannelAttribute(attribute) && attribute.isValidValue(value)) {
            await this.setAttributePowerChannel(attribute, value);
            this.updateLastRefresh();
            return value;
        }

        if (this.isPatternDetailAttribute(attribute) && attribute.isValidValue(value)) {
            await this.setAttributePatternDetail(attribute, value);
            this.updateLastRefresh();
            return value;
        }

        throw new Error(
            `Could not set value ${JSON.stringify(value)} (type: ${typeof value}) for attribute '${attributeName}'`
        );
    }

    private async setAttributePatternDetail(patternDetailAttr: Zc95DevicePatternAttributes[keyof Zc95DevicePatternAttributes], value: number): Promise<void> {

        const menuItemId = parseInt(patternDetailAttr.name.slice(Zc95Device.patternAttributePrefix.length), 10);

        if (!isNaN(menuItemId)) {
            throw new Error(`Attribute name '${patternDetailAttr.name}' does not contain a valid menu item id`);
        }

        if (IntRangeDeviceAttribute.isInstance(patternDetailAttr) && patternDetailAttr.isValidValue(value)) {
            const message = this.msgFactory.createPatternMinMaxChange(menuItemId, value);
            this.assertOkResponse(await this.messageResponseHandler.send(message));
            patternDetailAttr.value = value;
        } else if (ListDeviceAttribute.isInstance(patternDetailAttr) && patternDetailAttr.isValidValue(value)) {
            const message = this.msgFactory.createPatternMultiChoiceChange(menuItemId, value);
            this.assertOkResponse(await this.messageResponseHandler.send(message));
            patternDetailAttr.value = value;
        } else {
            throw new Error(
                `Unknown type for pattern detail attribute ${patternDetailAttr.name} (type: ${typeDetect.default(patternDetailAttr)}, value: ${value})`
            );
        }
    }

    private async setAttributePowerChannel(
        attribute: Zc95DevicePowerChannelAttributes[keyof Zc95DevicePowerChannelAttributes] & { name: keyof Zc95DevicePowerChannelAttributes },
        value: number
    ): Promise<void> {
        if (!this.allPowerChannelValuesDefined(this.attributes)) {
            return;
        }

        const tmpData: { [K in keyof Zc95DevicePowerChannelAttributes]-?: InitializedIntRangeDeviceAttribute['value'] } = {
            powerChannel1: this.attributes.powerChannel1.value,
            powerChannel2: this.attributes.powerChannel2.value,
            powerChannel3: this.attributes.powerChannel3.value,
            powerChannel4: this.attributes.powerChannel4.value,
        };

        tmpData[attribute.name] = Int.from(value);

        const message = this.msgFactory.createSetPower(
            tmpData.powerChannel1 * 10,
            tmpData.powerChannel2 * 10,
            tmpData.powerChannel3 * 10,
            tmpData.powerChannel4 * 10,
        );

        this.assertOkResponse(await this.messageResponseHandler.send(message));

        this.attributes[attribute.name].value = Int.from(value);
    }

    private allPowerChannelValuesDefined(attrs: Partial<Zc95DevicePowerChannelAttributes>): attrs is {
        [K in keyof Zc95DevicePowerChannelAttributes]-?: InitializedIntRangeDeviceAttribute
    } {
        return attrs.powerChannel1?.value !== undefined &&
            attrs.powerChannel2?.value !== undefined &&
            attrs.powerChannel3?.value !== undefined &&
            attrs.powerChannel4?.value !== undefined;
    }

    private async setAttributeActivePattern(value: number): Promise<void> {
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
            const patternDetailsMessage = this.msgFactory.createGetPatternDetails(
                this.attributes.activePattern.value
            );
            const patternDetails = await this.messageResponseHandler.send(patternDetailsMessage);

            if (undefined !== patternDetails) {
                const patternAttributes = this.getAttributesFromPatternDetails(patternDetails.MenuItems);

                Object.assign(this.attributes, this.getChannelPowerAttributes(), patternAttributes);
            }

            const patternStartMessage = this.msgFactory.createPatternStart(
                this.attributes.activePattern.value
            );
            this.assertOkResponse(await this.messageResponseHandler.send(patternStartMessage));
        } else {
            const patternStopMessage = this.msgFactory.createPatternStop();
            this.assertOkResponse(await this.messageResponseHandler.send(patternStopMessage));
            this.removePatternAttributesAndData();
        }

        this.attributes.patternStarted.value = value;
    }

    private getChannelPowerAttributes(): Zc95DevicePowerChannelAttributes {
        return {
            powerChannel1: this.getChannelPowerAttribute(1),
            powerChannel2: this.getChannelPowerAttribute(2),
            powerChannel3: this.getChannelPowerAttribute(3),
            powerChannel4: this.getChannelPowerAttribute(4),
        };
    }

    private getChannelPowerAttribute(channelIndex: number): IntRangeDeviceAttribute {
        return IntRangeDeviceAttribute.create(
            `${Zc95Device.powerChannelAttributePrefix}${channelIndex}`,
            `Channel ${channelIndex}`,
            DeviceAttributeModifier.readWrite,
            undefined,
            Int.ZERO,
            Int.ZERO,
            Int.from(1),
        );
    }

    private removePatternAttributesAndData(): void {
        getTypedKeys(this.attributes).forEach(key => {
            if (
                key.startsWith(Zc95Device.patternAttributePrefix) ||
                key.startsWith(Zc95Device.powerChannelAttributePrefix)
            ) {
                delete this.attributes[key];
            }
        });
    }

    private processPowerStatusMessage(msg: PowerStatusMsgResponse): void {
        for (const channel of msg.Channels) {
            const channelAttrName: Zc95DevicePowerChannelAttributesKey = `${Zc95Device.powerChannelAttributePrefix}${channel.Channel}`;
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

        this.updateLastRefresh();
    }

    private onReceivedMessage(data: Buffer): void
    {
        const decodedMessage = this.protocol.decode(data);

        if ('error' in decodedMessage) {
            this.logger.error(`Could not decode message`, decodedMessage.error);
            return;
        }

        if (this.isPowerStatusMessage(decodedMessage.message)) {
            this.processPowerStatusMessage(decodedMessage.message);
        }
    }

    private getAttributesFromPatternDetails(
        menuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[]
    ): Zc95DevicePatternAttributes {
        const patternAttributes: Zc95DevicePatternAttributes = {};

        for (const menuItem of menuItems) {
            const attrName: Zc95DevicePatternAttributesKey = `${Zc95Device.patternAttributePrefix}${menuItem.Id}`;

            if (this.isMinMaxMenuItem(menuItem)) {
                patternAttributes[attrName] = IntRangeDeviceAttribute.createInitialized(
                    attrName,
                    menuItem.Title,
                    DeviceAttributeModifier.readWrite,
                    'us' === menuItem.UoM ? 'µs' : menuItem.UoM,
                    Int.from(menuItem.Min),
                    Int.from(menuItem.Max),
                    Int.from(menuItem.IncrementStep),
                    Int.from(menuItem.Default),
                );
            } else if (this.isMultiChoiceMenuItem(menuItem)) {
                patternAttributes[attrName] = ListDeviceAttribute.createInitialized<Int, string>(
                    attrName,
                    menuItem.Title,
                    DeviceAttributeModifier.readWrite,
                    menuItem.Choices.map(choice => ({ key: Int.from(choice.Id), value: choice.Name })),
                    Int.from(menuItem.Default),
                );
            }
        }

        return patternAttributes;
    }

    private isPowerChannelAttribute(
        attribute: AnyZc95DeviceAttribute
    ): attribute is Zc95DevicePowerChannelAttributes[keyof Zc95DevicePowerChannelAttributes] & { name: keyof Zc95DevicePowerChannelAttributes } {
        return attribute !== undefined
            && attribute.name.startsWith(Zc95Device.powerChannelAttributePrefix)
            && ['1', '2', '3', '4'].includes(attribute.name.slice(Zc95Device.powerChannelAttributePrefix.length));
    }

    private isPatternStartedAttribute(attribute: AnyZc95DeviceAttribute): attribute is Zc95DeviceAttributes['patternStarted'] {
        return attribute?.name === 'patternStarted';
    }

    private isActivePatternAttribute(attribute: AnyZc95DeviceAttribute): attribute is Zc95DeviceAttributes['activePattern'] {
        return attribute?.name === 'activePattern';
    }

    private isPatternDetailAttribute(attribute: AnyZc95DeviceAttribute): attribute is Zc95DeviceAttributes[keyof Zc95DevicePatternAttributes] {
        return attribute !== undefined
            && attribute.name.startsWith(Zc95Device.patternAttributePrefix)
            && !isNaN(parseInt(attribute.name.slice(Zc95Device.patternAttributePrefix.length), 10));
    }

    private isPowerStatusMessage(msg: MsgResponse): msg is PowerStatusMsgResponse {
        return msg.MsgId === -1 && msg.Type === 'PowerStatus';
    }

    private isMinMaxMenuItem(menuItem: MenuItem): menuItem is MinMaxMenuItem {
        return menuItem.Type === 'MIN_MAX';
    }

    private isMultiChoiceMenuItem(menuItem: MenuItem): menuItem is MultiChoiceMenuItem {
        return menuItem.Type === 'MULTI_CHOICE';
    }

    private assertOkResponse(response: MsgResponse): void
    {
        if (response.Result !== 'OK') {
            const error = response.Error ?? '';
            throw new Error(`Device response is not OK, but ${response.Result}: ${error}`);
        }
    }
}
