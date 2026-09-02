import { Exclude, Expose } from 'class-transformer';
import type { AttributeKeyOf, AttributeValueOf, DeviceAttributeOf, DeviceInfo } from '../../device.js';
import type {
    MenuItem,
    MinMaxMenuItem,
    MultiChoiceMenuItem,
    PowerStatusMsgResponse,
} from './zc95MessageFactory.js';
import type Zc95MessageFactory from './zc95MessageFactory.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import type { InitializedListDeviceAttribute } from '../../attribute/listDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import type BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import { getTypedKeys } from '../../../util/objects.js';
import type { AllOrNone } from '../../../types.js';
import type { NoDeviceConfig } from '../../deviceConfig.js';
import PeripheralDevice from '../../peripheralDevice.js';
import type { MsgResponse } from './zc95Protocol.js';
import type Zc95Protocol from './zc95Protocol.js';
import typeDetect from 'type-detect';
import type BidirectionalDeviceTransport from '../../transport/deviceBidirectionalTransport.js';
import type MessageResponseHandler from '../messageResponseHandler.js';
import type Logger from '../../../logging/Logger.js';
import type EventEmitter from 'events';

type RequiredZc95DeviceAttributes = {
    activePattern: InitializedListDeviceAttribute<Int, string>;
    patternStarted: BoolDeviceAttribute;
};

export enum Zc95DevicePowerChannelIndex {
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
}

type Zc95DevicePowerChannelAttributesKeyPrefix = `powerChannel`;
type Zc95DevicePowerChannelAttributesKey = `${Zc95DevicePowerChannelAttributesKeyPrefix}${Zc95DevicePowerChannelIndex}`;

export type Zc95DevicePowerChannelAttributes = Record<Zc95DevicePowerChannelAttributesKey, IntRangeDeviceAttribute>;

type Zc95DevicePatternAttributesKeyPrefix = `patternAttribute`;
type Zc95DevicePatternAttributesKey = `${Zc95DevicePatternAttributesKeyPrefix}${number}`;

type Zc95DevicePatternAttributes = Partial<Record<Zc95DevicePatternAttributesKey, IntRangeDeviceAttribute | InitializedListDeviceAttribute<Int, string>>>;

export type Zc95DeviceAttributes = AllOrNone<Zc95DevicePowerChannelAttributes> & Zc95DevicePatternAttributes
    & Required<RequiredZc95DeviceAttributes>;

type AnyZc95DeviceAttribute = DeviceAttributeOf<Zc95DeviceAttributes>;

type AttributeValue<K extends keyof Zc95DeviceAttributes> = AttributeValueOf<Zc95DeviceAttributes, K>;

@Exclude()
export default class Zc95Device extends PeripheralDevice<Zc95Protocol, Zc95DeviceAttributes>
{
    private static readonly powerScaleFactor = 10;
    private static readonly patternAttributePrefix = 'patternAttribute';

    private static readonly powerChannelAttributePrefix = 'powerChannel';

    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
    private readonly fwVersion: string;

    private readonly msgFactory: Zc95MessageFactory;

    private readonly messageResponseHandler: MessageResponseHandler<Zc95Protocol>;

    public constructor(
        deviceInfo: DeviceInfo,
        fwVersion: string,
        protocol: Zc95Protocol,
        transport: BidirectionalDeviceTransport,
        attributes: Zc95DeviceAttributes,
        config: NoDeviceConfig,
        msgFactory: Zc95MessageFactory,
        messageResponseHandler: MessageResponseHandler<Zc95Protocol>,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, protocol, transport, attributes, config, eventEmitter, logger);
        this.fwVersion = fwVersion;
        this.msgFactory = msgFactory;

        this.transport.onReceive(data => this.onReceivedMessage(data));
        this.messageResponseHandler = messageResponseHandler;
    }

    public async setAttribute<
        K extends AttributeKeyOf<Zc95DeviceAttributes>,
    >(attributeName: K, value: AttributeValue<K>): Promise<AttributeValue<K>> {
        const attribute = this.attributes[attributeName];

        if (!this.isAttributePresent(attribute)) {
            throw new Error(`Attribute with name '${attributeName}' does not exist for this device`);
        }

        if (Zc95Device.isActivePatternAttribute(attribute) && attribute.isValidValue(value)) {
            await this.setAttributeActivePattern(value);
            this.updateLastRefresh();
            return attribute.value;
        }

        if (Zc95Device.isPatternStartedAttribute(attribute) && attribute.isValidValue(value)) {
            await this.setAttributePatternStarted(value);
            this.updateLastRefresh();
            return attribute.value;
        }

        if (Zc95Device.isPowerChannelAttribute(attribute) && attribute.isValidValue(value)) {
            await this.setAttributePowerChannel(attribute, value);
            this.updateLastRefresh();
            return attribute.value;
        }

        if (Zc95Device.isPatternDetailAttribute(attribute) && attribute.isValidValue(value)) {
            await this.setAttributePatternDetail(attribute, value);
            this.updateLastRefresh();
            return attribute.value;
        }

        throw new Error(
            `Could not set value ${JSON.stringify(value)} (type: ${typeof value}) for attribute '${attributeName}'`,
        );
    }

    private async setAttributePatternDetail(patternDetailAttr: DeviceAttributeOf<Zc95DevicePatternAttributes>, value: number): Promise<void> {
        const menuItemId = parseInt(patternDetailAttr.name.slice(Zc95Device.patternAttributePrefix.length), 10);

        if (isNaN(menuItemId)) {
            throw new Error(`Attribute name '${patternDetailAttr.name}' does not contain a valid menu item id`);
        }

        if (IntRangeDeviceAttribute.isInstance(patternDetailAttr) && patternDetailAttr.isValidValue(value)) {
            const message = this.msgFactory.createPatternMinMaxChange(menuItemId, value);
            Zc95Device.assertOkResponse(await this.messageResponseHandler.send(message));
            patternDetailAttr.value = value;
        } else if (ListDeviceAttribute.isInstance(patternDetailAttr) && patternDetailAttr.isValidValue(value)) {
            const message = this.msgFactory.createPatternMultiChoiceChange(menuItemId, value);
            Zc95Device.assertOkResponse(await this.messageResponseHandler.send(message));
            patternDetailAttr.value = value;
        } else {
            throw new Error(
                `Unknown type for pattern detail attribute ${patternDetailAttr.name} (type: ${typeDetect(patternDetailAttr)}, value: ${value})`,
            );
        }
    }

    private async setAttributePowerChannel(
        attribute: DeviceAttributeOf<Zc95DevicePowerChannelAttributes>,
        value: number,
    ): Promise<void> {
        if (!Zc95Device.allPowerChannelValuesDefined(this.attributes)) {
            throw new Error('Cannot set channel power before all channel values have been initialized');
        }

        const tmpData: { [K in keyof Zc95DevicePowerChannelAttributes]-?: IntRangeDeviceAttribute['value'] } = {
            powerChannel1: this.attributes.powerChannel1.value,
            powerChannel2: this.attributes.powerChannel2.value,
            powerChannel3: this.attributes.powerChannel3.value,
            powerChannel4: this.attributes.powerChannel4.value,
        };

        tmpData[attribute.name] = Int.from(value);

        const message = this.msgFactory.createSetPower(
            tmpData.powerChannel1 * Zc95Device.powerScaleFactor,
            tmpData.powerChannel2 * Zc95Device.powerScaleFactor,
            tmpData.powerChannel3 * Zc95Device.powerScaleFactor,
            tmpData.powerChannel4 * Zc95Device.powerScaleFactor,
        );

        Zc95Device.assertOkResponse(await this.messageResponseHandler.send(message));

        this.attributes[attribute.name].value = Int.from(value);
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
                this.attributes.activePattern.value,
            );
            const patternDetails = await this.messageResponseHandler.send(patternDetailsMessage);
            const patternAttributes = Zc95Device.getAttributesFromPatternDetails(patternDetails.MenuItems);

            Object.assign(this.attributes, Zc95Device.getChannelPowerAttributes(), patternAttributes);

            const patternStartMessage = this.msgFactory.createPatternStart(
                this.attributes.activePattern.value,
            );
            Zc95Device.assertOkResponse(await this.messageResponseHandler.send(patternStartMessage));
        } else {
            const patternStopMessage = this.msgFactory.createPatternStop();
            Zc95Device.assertOkResponse(await this.messageResponseHandler.send(patternStopMessage));
            this.removePatternAttributesAndData();
        }

        this.attributes.patternStarted.value = value;
    }

    private removePatternAttributesAndData(): void {
        getTypedKeys(this.attributes).forEach(key => {
            if (key.startsWith(Zc95Device.patternAttributePrefix)
                || key.startsWith(Zc95Device.powerChannelAttributePrefix)
            ) {
                Reflect.deleteProperty(this.attributes, key);
            }
        });
    }

    private processPowerStatusMessage(msg: PowerStatusMsgResponse): void {
        for (const channel of msg.Channels) {
            const channelAttrName: Zc95DevicePowerChannelAttributesKey = `${Zc95Device.powerChannelAttributePrefix}${channel.Channel}`;
            const channelAttr = this.attributes[channelAttrName];
            const percentagePowerLimit = Int.from(Math.floor(channel.PowerLimit / Zc95Device.powerScaleFactor));

            if (!channelAttr) {
                continue;
            }

            if (undefined !== this.attributes[channelAttrName]?.value
                && this.attributes[channelAttrName].value > percentagePowerLimit
            ) {
                this.attributes[channelAttrName].value = percentagePowerLimit;
            }

            channelAttr.value = Int.from(Math.floor(channel.MaxOutputPower / Zc95Device.powerScaleFactor)); // or channel.OutputPower?
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

        if (Zc95Device.isPowerStatusMessage(decodedMessage.message)) {
            this.processPowerStatusMessage(decodedMessage.message);
        }
    }

    private static getAttributesFromPatternDetails(
        menuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[],
    ): Zc95DevicePatternAttributes {
        const patternAttributes: Zc95DevicePatternAttributes = {};

        for (const menuItem of menuItems) {
            const attrName: Zc95DevicePatternAttributesKey = `${Zc95Device.patternAttributePrefix}${menuItem.Id}`;

            if (Zc95Device.isMinMaxMenuItem(menuItem)) {
                patternAttributes[attrName] = IntRangeDeviceAttribute.create({
                    name: attrName,
                    label: menuItem.Title,
                    modifier: DeviceAttributeModifier.readWrite,
                    uom: 'us' === menuItem.UoM ? 'µs' : menuItem.UoM,
                    min: Int.from(menuItem.Min),
                    max: Int.from(menuItem.Max),
                    incrementStep: Int.from(menuItem.IncrementStep),
                    initialValue: Int.from(menuItem.Default),
                });
            } else if (Zc95Device.isMultiChoiceMenuItem(menuItem)) {
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

    private static getChannelPowerAttribute(channelIndex: Zc95DevicePowerChannelIndex): IntRangeDeviceAttribute {
        return IntRangeDeviceAttribute.create({
            name: `${Zc95Device.powerChannelAttributePrefix}${channelIndex}`,
            label: `Channel ${channelIndex}`,
            modifier: DeviceAttributeModifier.readWrite,
            min: Int.ZERO,
            max: Int.ZERO,
            initialValue: Int.ZERO,
        });
    }

    private static getChannelPowerAttributes(): Zc95DevicePowerChannelAttributes {
        return {
            powerChannel1: Zc95Device.getChannelPowerAttribute(Zc95DevicePowerChannelIndex.One),
            powerChannel2: Zc95Device.getChannelPowerAttribute(Zc95DevicePowerChannelIndex.Two),
            powerChannel3: Zc95Device.getChannelPowerAttribute(Zc95DevicePowerChannelIndex.Three),
            powerChannel4: Zc95Device.getChannelPowerAttribute(Zc95DevicePowerChannelIndex.Four),
        };
    }

    private static allPowerChannelValuesDefined(attrs: Partial<Zc95DevicePowerChannelAttributes>): attrs is {
        [K in keyof Zc95DevicePowerChannelAttributes]-?: IntRangeDeviceAttribute
    } {
        return attrs.powerChannel1?.value !== undefined
            && attrs.powerChannel2?.value !== undefined
            && attrs.powerChannel3?.value !== undefined
            && attrs.powerChannel4?.value !== undefined
        ;
    }

    private static isPowerChannelAttribute(
        attribute: AnyZc95DeviceAttribute,
    ): attribute is DeviceAttributeOf<Zc95DevicePowerChannelAttributes> {
        return attribute.name.startsWith(Zc95Device.powerChannelAttributePrefix)
            && ['1', '2', '3', '4'].includes(attribute.name.slice(Zc95Device.powerChannelAttributePrefix.length));
    }

    private static isPatternStartedAttribute(attribute: AnyZc95DeviceAttribute): attribute is Zc95DeviceAttributes['patternStarted'] & { name: 'patternStarted' } {
        return attribute.name === 'patternStarted';
    }

    private static isActivePatternAttribute(attribute: AnyZc95DeviceAttribute): attribute is Zc95DeviceAttributes['activePattern'] & { name: 'activePattern' } {
        return attribute.name === 'activePattern';
    }

    private static isPatternDetailAttribute(attribute: AnyZc95DeviceAttribute): attribute is DeviceAttributeOf<Zc95DevicePatternAttributes> {
        return attribute.name.startsWith(Zc95Device.patternAttributePrefix)
            && !isNaN(parseInt(attribute.name.slice(Zc95Device.patternAttributePrefix.length), 10));
    }

    private static isPowerStatusMessage(msg: MsgResponse): msg is PowerStatusMsgResponse {
        return msg.MsgId === -1 && msg.Type === 'PowerStatus';
    }

    private static isMinMaxMenuItem(menuItem: MenuItem): menuItem is MinMaxMenuItem {
        return menuItem.Type === 'MIN_MAX';
    }

    private static isMultiChoiceMenuItem(menuItem: MenuItem): menuItem is MultiChoiceMenuItem {
        return menuItem.Type === 'MULTI_CHOICE';
    }

    private static assertOkResponse(response: MsgResponse): void
    {
        if (response.Result !== 'OK') {
            const error = response.Error ?? '';
            throw new Error(`Device response is not OK, but ${response.Result}: ${error}`);
        }
    }
}
