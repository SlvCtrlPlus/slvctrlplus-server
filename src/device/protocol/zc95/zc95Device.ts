import { Exclude, Expose } from 'class-transformer';
import type { DeviceDataUpdate, DeviceDataApplyError, DeviceDataUpdateResult, DeviceInfo } from '../../device.js';
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
import { zc95AttributesSchema } from './zc95AttributesSchema.js';
import type { Zc95AttributeValues, Zc95StartedAttributes, Zc95StartedWithPowerAttributes } from './zc95AttributesSchema.js';
import type JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';

export enum Zc95DevicePowerChannelIndex {
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
}

export type { Zc95AttributeValues } from './zc95AttributesSchema.js';

export type PatternDetail = PatternsMsgResponse['Patterns'][number];

export type PowerChannelState = { channel: Zc95DevicePowerChannelIndex, maxOutputPower: number };

/** Power channel keys as they appear in the nested `powerChannels` object. */
type PowerChannelKey = '1' | '2' | '3' | '4';

/** Narrowed API surface available after `isPatternStarted()` returns true. */
export type Zc95StartedDeviceApi = {
    updateDeviceData: (update: DeviceDataUpdate<Zc95StartedAttributes>) => Promise<DeviceDataUpdateResult<Zc95AttributeValues>>;
    getDeviceData: () => Zc95StartedAttributes;
};

@Exclude()
export default class Zc95Device extends PeripheralDevice<Zc95Protocol, Zc95AttributeValues>
{
    private static readonly powerScaleFactor = 10;

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
        attributesSchema: ReturnType<typeof zc95AttributesSchema>,
        attributes: Zc95AttributeValues,
        patterns: PatternDetail[],
        config: NoDeviceConfig,
        msgFactory: Zc95MessageFactory,
        messageResponseHandler: MessageResponseHandler<Zc95Protocol>,
        validatorFactory: JsonSchemaValidatorFactory,
        eventEmitter: EventEmitter,
        logger: Logger,
        activePatternMenuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[] = [],
        powerChannelState: PowerChannelState[] = [],
    ) {
        super(deviceInfo, protocol, transport, attributesSchema, attributes, validatorFactory, config, eventEmitter, logger);
        this.fwVersion = fwVersion;
        this.patterns = patterns;
        this.activePatternMenuItems = activePatternMenuItems;
        this.powerChannelState = powerChannelState;
        this.msgFactory = msgFactory;

        this.transport.onReceive(data => this.onReceivedMessage(data));
        this.messageResponseHandler = messageResponseHandler;
    }

    /** Type guard: narrows this device to expose power-channel and pattern-attribute keys with precise types. */
    public isPatternStarted(): this is Zc95Device & Zc95StartedDeviceApi {
        return this.data.patternStarted;
    }

    /**
     * Ordered apply: activePattern → patternStarted → powerChannels → patternAttributes.
     * Called by the base class after the merged candidate has passed schema validation.
     */
    protected override async applyDeviceData(
        update: DeviceDataUpdate<Zc95AttributeValues>,
    ): Promise<DeviceDataApplyError[]> {
        const errors: DeviceDataApplyError[] = [];

        if ('activePattern' in update && typeof update.activePattern === 'number') {
            try {
                await this.setAttributeActivePattern(update.activePattern);
            } catch (e: unknown) {
                errors.push({ path: '/activePattern', message: e instanceof Error ? e.message : String(e) });
            }
        }

        if ('patternStarted' in update && typeof update.patternStarted === 'boolean') {
            try {
                await this.setAttributePatternStarted(update.patternStarted);
            } catch (e: unknown) {
                errors.push({ path: '/patternStarted', message: e instanceof Error ? e.message : String(e) });
            }
        }

        if ('powerChannels' in update && update.powerChannels !== undefined) {
            try {
                await this.setAttributePowerChannels(update.powerChannels);
            } catch (e: unknown) {
                errors.push({ path: '/powerChannels', message: e instanceof Error ? e.message : String(e) });
            }
        }

        if ('patternAttributes' in update && update.patternAttributes !== undefined) {
            try {
                await this.setAttributePatternAttributes(update.patternAttributes);
            } catch (e: unknown) {
                errors.push({ path: '/patternAttributes', message: e instanceof Error ? e.message : String(e) });
            }
        }

        return errors;
    }

    /**
     * Transition-aware base state:
     * - stopping: strip nested groups so the stopped schema branch validates
     * - starting: seed mandatory `patternAttributes` (populated during apply)
     * - otherwise: current state as-is
     */
    protected override candidateBase(update: DeviceDataUpdate<Zc95AttributeValues>): Zc95AttributeValues {
        const current = super.candidateBase(update);

        if ('patternStarted' in update && false === update.patternStarted) {
            return { activePattern: current.activePattern, patternStarted: false };
        }

        if ('patternStarted' in update && true === update.patternStarted && !current.patternStarted) {
            return {
                activePattern: current.activePattern,
                patternStarted: true,
                patternAttributes: {},
            };
        }

        return current;
    }

    /** Narrows attributes to started state. Throws if pattern not running. */
    private getStartedAttributes(): Zc95StartedAttributes {
        if (!this.data.patternStarted) {
            throw new Error('Pattern is not started');
        }

        return this.data;
    }

    private async setAttributePatternAttributes(
        incoming: Record<string, unknown>,
    ): Promise<void> {
        const attrs = this.getStartedAttributes();

        for (const [key, value] of Object.entries(incoming)) {
            if (typeof value !== 'number') {
                throw new Error(`Expected number value for pattern attribute '${key}', got ${typeof value}`);
            }

            const menuItemId = parseInt(key, 10);

            if (isNaN(menuItemId)) {
                throw new Error(`Pattern attribute key '${key}' is not a valid menu item id`);
            }

            const menuItem = this.activePatternMenuItems.find(item => item.Id === menuItemId);

            if (!menuItem) {
                throw new Error(`No menu item found for pattern attribute '${key}'`);
            }

            if ('MIN_MAX' === menuItem.Type) {
                const message = this.msgFactory.createPatternMinMaxChange(menuItemId, value);
                Zc95Device.assertOkResponse(await this.messageResponseHandler.send(message));
            } else {
                const message = this.msgFactory.createPatternMultiChoiceChange(menuItemId, value);
                Zc95Device.assertOkResponse(await this.messageResponseHandler.send(message));
            }

            attrs.patternAttributes[key] = value;
        }
    }

    private async setAttributePowerChannels(incoming: Record<string, unknown>): Promise<void> {
        const attrs = this.getStartedAttributes();

        if (!Zc95Device.hasPowerChannels(attrs)) {
            throw new Error('Power channels are not yet available (waiting for first PowerStatus message)');
        }

        // Merge incoming values with current state, validating each channel key
        const merged = { ...attrs.powerChannels };

        for (const [key, val] of Object.entries(incoming)) {
            if (!Zc95Device.isPowerChannelKey(key)) {
                throw new Error(`Invalid power channel key '${key}'`);
            }

            if (typeof val !== 'number') {
                throw new Error(`Expected number value for power channel '${key}', got ${typeof val}`);
            }

            merged[key] = val;
        }

        const message = this.msgFactory.createSetPower(
            merged[1] * Zc95Device.powerScaleFactor,
            merged[2] * Zc95Device.powerScaleFactor,
            merged[3] * Zc95Device.powerScaleFactor,
            merged[4] * Zc95Device.powerScaleFactor,
        );

        Zc95Device.assertOkResponse(await this.messageResponseHandler.send(message));

        attrs.powerChannels = merged;
    }

    private async setAttributeActivePattern(value: number): Promise<void> {
        if (this.data.activePattern === value) {
            return;
        }

        if (this.data.patternStarted) {
            await this.setAttributePatternStarted(false);
        }

        this.data.activePattern = value;
    }

    private async setAttributePatternStarted(value: boolean): Promise<void> {
        if (this.data.patternStarted === value) {
            return;
        }

        if (value) {
            const patternDetailsMessage = this.msgFactory.createGetPatternDetails(
                this.data.activePattern,
            );
            const patternDetails = await this.messageResponseHandler.send(patternDetailsMessage);

            this.activePatternMenuItems = patternDetails.MenuItems;

            // Build started state — no powerChannels yet (seeded on first PowerStatus)
            const patternAttributes: Record<string, number> = {};
            for (const menuItem of patternDetails.MenuItems) {
                patternAttributes[String(menuItem.Id)] = menuItem.Default;
            }

            this.data = {
                activePattern: this.data.activePattern,
                patternStarted: true,
                patternAttributes,
            };

            this.powerChannelState = [];
            this.rebuildSchema();

            const patternStartMessage = this.msgFactory.createPatternStart(
                this.data.activePattern,
            );
            Zc95Device.assertOkResponse(await this.messageResponseHandler.send(patternStartMessage));
        } else {
            const patternStopMessage = this.msgFactory.createPatternStop();
            Zc95Device.assertOkResponse(await this.messageResponseHandler.send(patternStopMessage));

            // Transition to stopped state
            this.data = {
                activePattern: this.data.activePattern,
                patternStarted: false,
            };

            this.activePatternMenuItems = [];
            this.powerChannelState = [];
            this.rebuildSchema();
        }
    }

    private processPowerStatusMessage(msg: PowerStatusMsgResponse): void {
        if (!this.data.patternStarted) {
            return;
        }

        const attrs = this.data;
        let schemaChanged = false;
        const needsSeed = !Zc95Device.hasPowerChannels(attrs);

        // If powerChannels don't exist yet, seed them and re-narrow
        if (needsSeed) {
            this.data = { ...attrs, powerChannels: { 1: 0, 2: 0, 3: 0, 4: 0 } };
        }

        // Re-read after potential seed; narrow to started-with-power
        const currentAttrs = this.data;
        if (!Zc95Device.hasPowerChannels(currentAttrs)) {
            return;
        }

        for (const channel of msg.Channels) {
            const channelKeyStr = String(channel.Channel);

            if (!Zc95Device.isPowerChannelKey(channelKeyStr)) {
                continue;
            }

            const channelKey = channelKeyStr;
            const percentagePowerLimit = Math.floor(channel.PowerLimit / Zc95Device.powerScaleFactor);

            if (currentAttrs.powerChannels[channelKey] > percentagePowerLimit) {
                currentAttrs.powerChannels[channelKey] = percentagePowerLimit;
            }

            currentAttrs.powerChannels[channelKey] = Math.floor(channel.MaxOutputPower / Zc95Device.powerScaleFactor);

            const channelState = this.powerChannelState.find(c => c.channel === channel.Channel);

            if (channelState) {
                if (channelState.maxOutputPower !== percentagePowerLimit) {
                    channelState.maxOutputPower = percentagePowerLimit;
                    schemaChanged = true;
                }
            } else {
                this.powerChannelState.push({ channel: channel.Channel, maxOutputPower: percentagePowerLimit });
                schemaChanged = true;
            }
        }

        if (schemaChanged || needsSeed) {
            this.rebuildSchema();
        }

        this.updateLastRefresh();
    }

    /** Rebuilds the attributes schema from current device state and recompiles the validator. */
    private rebuildSchema(): void {
        this.updateAttributesSchema(zc95AttributesSchema({
            patterns: this.patterns,
            activePatternMenuItems: this.activePatternMenuItems,
            powerChannels: this.powerChannelState,
        }));
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

    /** Narrows started attributes to the branch with powerChannels. */
    private static hasPowerChannels(attrs: Zc95StartedAttributes): attrs is Zc95StartedWithPowerAttributes {
        return 'powerChannels' in attrs;
    }

    private static isPowerChannelKey(key: string): key is PowerChannelKey {
        return ['1', '2', '3', '4'].includes(key);
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
