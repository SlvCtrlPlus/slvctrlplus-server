import { Exclude, Expose } from 'class-transformer';
import type { AttributeKeyOf, AttributeValueOf, DeviceInfo } from '../../device.js';
import type {
    MinMaxMenuItem,
    MultiChoiceMenuItem,
    PatternsMsgResponse,
    PowerStatusMsgResponse,
} from './zc95MessageFactory.js';
import type Zc95MessageFactory from './zc95MessageFactory.js';
import type { NoDeviceConfig } from '../../deviceConfig.js';
import PeripheralDevice from '../../peripheralDevice.js';
import type { MsgResponse } from './zc95Protocol.js';
import type Zc95Protocol from './zc95Protocol.js';
import type BidirectionalDeviceTransport from '../../transport/deviceBidirectionalTransport.js';
import type MessageResponseHandler from '../messageResponseHandler.js';
import type Logger from '../../../logging/Logger.js';
import type EventEmitter from 'events';
import type { TObject, TSchema } from '@sinclair/typebox';
import { zc95AttributesSchema } from './zc95AttributesSchema.js';
import type { Zc95AttributeValues } from './zc95AttributesSchema.js';

export enum Zc95DevicePowerChannelIndex {
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
}

type Zc95DevicePowerChannelAttributesKey = `powerChannel${Zc95DevicePowerChannelIndex}`;

export type { Zc95AttributeValues } from './zc95AttributesSchema.js';

export type PatternDetail = PatternsMsgResponse['Patterns'][number];

export type PowerChannelState = { channel: Zc95DevicePowerChannelIndex, maxOutputPower: number };

@Exclude()
export default class Zc95Device extends PeripheralDevice<Zc95Protocol, Zc95AttributeValues>
{
    private static readonly powerScaleFactor = 10;
    private static readonly patternAttributePrefix = 'patternAttribute';
    private static readonly powerChannelAttributePrefix = 'powerChannel';

    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
    private readonly fwVersion: string;

    private readonly msgFactory: Zc95MessageFactory;

    private readonly messageResponseHandler: MessageResponseHandler<Zc95Protocol>;

    /** Stored pattern list so the schema can be rebuilt without re-fetching. */
    private readonly patterns: PatternDetail[];

    /** The menu items of the currently active pattern (empty when no pattern is started). */
    private activePatternMenuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[] = [];

    /** Power channel state for schema rebuilding. */
    private powerChannelState: PowerChannelState[] = [];

    // eslint-disable-next-line @typescript-eslint/max-params
    public constructor(
        deviceInfo: DeviceInfo,
        fwVersion: string,
        protocol: Zc95Protocol,
        transport: BidirectionalDeviceTransport,
        attributesSchema: TObject,
        attributes: Zc95AttributeValues,
        patterns: PatternDetail[],
        config: NoDeviceConfig,
        msgFactory: Zc95MessageFactory,
        messageResponseHandler: MessageResponseHandler<Zc95Protocol>,
        eventEmitter: EventEmitter,
        logger: Logger,
        activePatternMenuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[] = [],
        powerChannelState: PowerChannelState[] = [],
    ) {
        super(deviceInfo, protocol, transport, attributesSchema, attributes, config, eventEmitter, logger);
        this.fwVersion = fwVersion;
        this.patterns = patterns;
        this.activePatternMenuItems = activePatternMenuItems;
        this.powerChannelState = powerChannelState;
        this.msgFactory = msgFactory;

        this.transport.onReceive(data => this.onReceivedMessage(data));
        this.messageResponseHandler = messageResponseHandler;
    }

    public async setAttribute<
        K extends AttributeKeyOf<Zc95AttributeValues>,
    >(attributeName: K, value: AttributeValueOf<Zc95AttributeValues, K>): Promise<AttributeValueOf<Zc95AttributeValues, K>> {
        if (!this.hasAttribute(attributeName)) {
            throw new Error(`Attribute with name '${attributeName}' does not exist for this device`);
        }

        if ('activePattern' === attributeName) {
            await this.setAttributeActivePattern(value);
            this.updateLastRefresh();
            return value;
        }

        if ('patternStarted' === attributeName) {
            await this.setAttributePatternStarted(value);
            this.updateLastRefresh();
            return value;
        }

        if (Zc95Device.isPowerChannelKey(attributeName)) {
            await this.setAttributePowerChannel(attributeName, value);
            this.updateLastRefresh();
            return value;
        }

        if (Zc95Device.isPatternDetailKey(attributeName)) {
            await this.setAttributePatternDetail(attributeName, value);
            this.updateLastRefresh();
            return value;
        }

        throw new Error(
            `Could not set value ${JSON.stringify(value)} (type: ${typeof value}) for attribute '${attributeName}'`,
        );
    }

    private async setAttributePatternDetail(
        attributeName: string,
        value: unknown,
    ): Promise<void> {
        const menuItemId = parseInt(attributeName.slice(Zc95Device.patternAttributePrefix.length), 10);

        if (isNaN(menuItemId)) {
            throw new Error(`Attribute name '${attributeName}' does not contain a valid menu item id`);
        }

        const propertySchema = this.getPropertySchema(attributeName);

        if (typeof value !== 'number') {
            throw new Error(`Expected number value for pattern attribute '${attributeName}', got ${typeof value}`);
        }

        if (Zc95Device.isRangeProperty(propertySchema)) {
            const message = this.msgFactory.createPatternMinMaxChange(menuItemId, value);
            Zc95Device.assertOkResponse(await this.messageResponseHandler.send(message));
            this.attributes[`patternAttribute${menuItemId}`] = value;
        } else if (Zc95Device.isListProperty(propertySchema)) {
            const message = this.msgFactory.createPatternMultiChoiceChange(menuItemId, value);
            Zc95Device.assertOkResponse(await this.messageResponseHandler.send(message));
            this.attributes[`patternAttribute${menuItemId}`] = value;
        } else {
            throw new Error(
                `Unknown schema type for pattern detail attribute ${attributeName}`,
            );
        }
    }

    private async setAttributePowerChannel(
        attributeName: Zc95DevicePowerChannelAttributesKey,
        value: unknown,
    ): Promise<void> {
        if (!this.allPowerChannelValuesDefined()) {
            throw new Error('Cannot set channel power before all channel values have been initialized');
        }

        if (typeof value !== 'number') {
            throw new Error(`Expected number value for power channel '${attributeName}', got ${typeof value}`);
        }

        const pick = (k: Zc95DevicePowerChannelAttributesKey): number =>
            (k === attributeName ? value : this.getPowerChannelValue(k)) * Zc95Device.powerScaleFactor;

        const message = this.msgFactory.createSetPower(
            pick('powerChannel1'),
            pick('powerChannel2'),
            pick('powerChannel3'),
            pick('powerChannel4'),
        );

        Zc95Device.assertOkResponse(await this.messageResponseHandler.send(message));

        this.attributes[attributeName] = value;
    }

    private getPowerChannelValue(key: Zc95DevicePowerChannelAttributesKey): number {
        const value = this.attributes[key];

        if (typeof value !== 'number') {
            throw new Error(`Power channel '${key}' value is not a number`);
        }

        return value;
    }

    private allPowerChannelValuesDefined(): boolean {
        return this.attributes.powerChannel1 !== undefined
            && this.attributes.powerChannel2 !== undefined
            && this.attributes.powerChannel3 !== undefined
            && this.attributes.powerChannel4 !== undefined;
    }

    private async setAttributeActivePattern(value: unknown): Promise<void> {
        if (this.attributes.activePattern === value) {
            return;
        }

        if (typeof value !== 'number') {
            throw new Error(`Expected number value for activePattern, got ${typeof value}`);
        }

        if (this.attributes.patternStarted) {
            await this.setAttributePatternStarted(false);
        }

        this.attributes.activePattern = value;
    }

    private async setAttributePatternStarted(value: unknown): Promise<void> {
        if (this.attributes.patternStarted === value) {
            return;
        }

        if (typeof value !== 'boolean') {
            throw new Error(`Expected boolean value for patternStarted, got ${typeof value}`);
        }

        if (value) {
            const patternDetailsMessage = this.msgFactory.createGetPatternDetails(
                this.attributes.activePattern,
            );
            const patternDetails = await this.messageResponseHandler.send(patternDetailsMessage);

            this.activePatternMenuItems = patternDetails.MenuItems;

            // Add power channel and pattern attributes
            this.attributes.powerChannel1 = 0;
            this.attributes.powerChannel2 = 0;
            this.attributes.powerChannel3 = 0;
            this.attributes.powerChannel4 = 0;

            for (const menuItem of patternDetails.MenuItems) {
                this.attributes[`patternAttribute${menuItem.Id}`] = menuItem.Default;
            }

            this.powerChannelState = [
                { channel: Zc95DevicePowerChannelIndex.One, maxOutputPower: 0 },
                { channel: Zc95DevicePowerChannelIndex.Two, maxOutputPower: 0 },
                { channel: Zc95DevicePowerChannelIndex.Three, maxOutputPower: 0 },
                { channel: Zc95DevicePowerChannelIndex.Four, maxOutputPower: 0 },
            ];

            this.rebuildSchema();

            const patternStartMessage = this.msgFactory.createPatternStart(
                this.attributes.activePattern,
            );
            Zc95Device.assertOkResponse(await this.messageResponseHandler.send(patternStartMessage));
            this.attributes.patternStarted = true;
        } else {
            const patternStopMessage = this.msgFactory.createPatternStop();
            Zc95Device.assertOkResponse(await this.messageResponseHandler.send(patternStopMessage));

            // Remove power channel and pattern attributes
            this.removePatternAttributesAndData();
            this.rebuildSchema();
            this.attributes.patternStarted = false;
        }
    }

    private removePatternAttributesAndData(): void {
        const keysToRemove = Object.keys(this.attributes).filter(key =>
            key.startsWith(Zc95Device.patternAttributePrefix)
            || key.startsWith(Zc95Device.powerChannelAttributePrefix),
        );

        for (const key of keysToRemove) {
            Reflect.deleteProperty(this.attributes, key);
        }

        this.activePatternMenuItems = [];
        this.powerChannelState = [];
    }

    private processPowerStatusMessage(msg: PowerStatusMsgResponse): void {
        if (!this.attributes.patternStarted) {
            return;
        }

        const attrs = this.attributes;
        let schemaChanged = false;

        for (const channel of msg.Channels) {
            const channelAttrName: Zc95DevicePowerChannelAttributesKey = `${Zc95Device.powerChannelAttributePrefix}${channel.Channel}`;

            const percentagePowerLimit = Math.floor(channel.PowerLimit / Zc95Device.powerScaleFactor);
            const currentValue = attrs[channelAttrName];

            if (currentValue !== undefined && currentValue > percentagePowerLimit) {
                attrs[channelAttrName] = percentagePowerLimit;
            }

            attrs[channelAttrName] = Math.floor(channel.MaxOutputPower / Zc95Device.powerScaleFactor);

            const channelState = this.powerChannelState.find(c => c.channel === channel.Channel);

            if (channelState && channelState.maxOutputPower !== percentagePowerLimit) {
                channelState.maxOutputPower = percentagePowerLimit;
                schemaChanged = true;
            }
        }

        if (schemaChanged) {
            this.rebuildSchema();
        }

        this.updateLastRefresh();
    }

    /** Rebuilds the attributes schema from current device state. */
    private rebuildSchema(): void {
        this.attributesSchema = zc95AttributesSchema({
            patterns: this.patterns,
            activePatternMenuItems: this.activePatternMenuItems,
            powerChannels: this.powerChannelState,
        });
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

    /** Gets the JSON Schema for a single attribute property. */
    private getPropertySchema(attributeName: string): TSchema {
        const schema = this.attributesSchema.properties[attributeName];

        if (!schema) {
            throw new Error(`No schema found for attribute '${attributeName}'`);
        }

        return schema;
    }

    private static isPowerChannelKey(key: string): key is Zc95DevicePowerChannelAttributesKey {
        return key.startsWith(Zc95Device.powerChannelAttributePrefix)
            && ['1', '2', '3', '4'].includes(key.slice(Zc95Device.powerChannelAttributePrefix.length));
    }

    private static isPatternDetailKey(key: string): boolean {
        return key.startsWith(Zc95Device.patternAttributePrefix)
            && !isNaN(parseInt(key.slice(Zc95Device.patternAttributePrefix.length), 10));
    }

    /** Checks if a property schema represents a range (MIN_MAX) attribute. */
    private static isRangeProperty(schema: TSchema): boolean {
        return 'minimum' in schema && 'maximum' in schema;
    }

    /** Checks if a property schema represents a list (MULTI_CHOICE) attribute. */
    private static isListProperty(schema: TSchema): boolean {
        return 'oneOf' in schema;
    }

    private static isPowerStatusMessage(msg: MsgResponse): msg is PowerStatusMsgResponse {
        return msg.MsgId === -1 && msg.Type === 'PowerStatus';
    }

    private static assertOkResponse(response: MsgResponse): void
    {
        if (response.Result !== 'OK') {
            const error = response.Error ?? '';
            throw new Error(`Device response is not OK, but ${response.Result}: ${error}`);
        }
    }
}
