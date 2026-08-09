import type { AttributeKeyOf, AttributeValueOf, DeviceInfo } from '../../device.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import type { Estim2bCommand, EStim2bStatus } from './estim2bProtocol.js';
import type EStim2bProtocol from './estim2bProtocol.js';
import { EStim2bMode } from './estim2bProtocol.js';
import { Exclude, Expose } from 'class-transformer';
import { Int } from '../../../util/numbers.js';
import type BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import type StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import type ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import { DeviceAttributeModifier, isValidAttributeValue } from '../../attribute/deviceAttribute.js';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import PeripheralDevice from '../../peripheralDevice.js';
import { getErrorFromDecodeResult } from '../deviceProtocol.js';
import type EventEmitter from 'events';
import type Logger from '../../../logging/Logger.js';

export type EStim2bDeviceAttributes = {
    mode: ListDeviceAttribute<Int, string>;
    channelALevel: IntRangeDeviceAttribute;
    channelBLevel: IntRangeDeviceAttribute;
    pulseFrequency?: IntRangeDeviceAttribute;
    pulsePwm?: IntRangeDeviceAttribute;
    channelsJoined: BoolDeviceAttribute;
    highPowerMode: BoolDeviceAttribute;
    batteryStatus: StrDeviceAttribute;
};

export type EStim2bBatteryStatus = 'mains' | 'full' | 'medium' | 'low' | 'critical';

type AttributeValue<K extends keyof EStim2bDeviceAttributes> = AttributeValueOf<EStim2bDeviceAttributes, K>;

@Exclude()
export default class EStim2bDevice extends PeripheralDevice<EStim2bProtocol, EStim2bDeviceAttributes>
{
    private static readonly REFRESH_INTERVAL_MS = 175;
    private static readonly TRANSPORT_TIMEOUT_MS = 250;
    private static readonly PULSE_ATTR_MIN = 2;
    private static readonly PULSE_ATTR_MAX = 100;
    private static readonly BATTERY_LEVEL_MAINS_THRESHOLD = 720;
    private static readonly BATTERY_LEVEL_FULL_THRESHOLD = 550;
    private static readonly BATTERY_LEVEL_MEDIUM_THRESHOLD = 525;
    private static readonly BATTERY_LEVEL_LOW_THRESHOLD = 500;

    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
    private readonly fwVersion: string;

    public constructor(
        deviceInfo: DeviceInfo,
        status: EStim2bStatus,
        protocol: EStim2bProtocol,
        transport: DeviceBidirectionalTransport,
        attributes: EStim2bDeviceAttributes,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, protocol, transport, attributes, {}, eventEmitter, logger);

        this.fwVersion = status.firmwareVersion;
        this.attributes = this.setModeBasedAttributes(status);
    }

    public static humanReadableBatteryLevel(adc: number): EStim2bBatteryStatus {
        if (adc > EStim2bDevice.BATTERY_LEVEL_MAINS_THRESHOLD) return 'mains';
        if (adc > EStim2bDevice.BATTERY_LEVEL_FULL_THRESHOLD) return 'full';
        if (adc > EStim2bDevice.BATTERY_LEVEL_MEDIUM_THRESHOLD) return 'medium';
        if (adc > EStim2bDevice.BATTERY_LEVEL_LOW_THRESHOLD) return 'low';
        return 'critical';
    }

    public override get getRefreshInterval(): number {
        return EStim2bDevice.REFRESH_INTERVAL_MS;
    }

    public async setAttribute<
        K extends AttributeKeyOf<EStim2bDeviceAttributes>,
    >(attributeName: K, value: AttributeValue<K>): Promise<AttributeValue<K>> {
        const attribute = this.attributes[attributeName];

        if (undefined === attribute) {
            throw new Error(`Attribute '${attributeName}' does not exist`);
        }

        let result: EStim2bStatus;

        if ('mode' === attributeName && this.attributes.mode.isValidValue(value)) {
            result = await this.send(this.protocol.createSetModeCommand(value));
            this.attributes = this.setModeBasedAttributes(result);
        } else if ('channelALevel' === attributeName && isValidAttributeValue(this.attributes.channelALevel, value)) {
            result = await this.send(this.protocol.createSetPowerCommand('A', value));
        } else if ('channelBLevel' === attributeName && isValidAttributeValue(this.attributes.channelBLevel, value)) {
            result = await this.send(this.protocol.createSetPowerCommand('B', value));
        } else if ('pulseFrequency' === attributeName && isValidAttributeValue(this.attributes.pulseFrequency, value)) {
            result = await this.send(this.protocol.createSetPulseFrequencyCommand(value));
        } else if ('pulsePwm' === attributeName && isValidAttributeValue(this.attributes.pulsePwm, value)) {
            result = await this.send(this.protocol.createSetPulsePwmCommand(value));
        } else if ('highPowerMode' === attributeName && isValidAttributeValue(this.attributes.highPowerMode, value)) {
            result = await this.send(this.protocol.createSetPowerModeCommand(value ? 'H' : 'L'));
        } else {
            throw new Error(`Could not set value ${JSON.stringify(value)} (type: ${typeof value}) for attribute '${attributeName}'`);
        }

        this.updateAttributeValues(result);

        return attribute.value;
    }

    protected updateAttributeValues(status: EStim2bStatus): void {
        this.attributes.mode.value = Int.from(status.currentMode);
        this.attributes.channelALevel.value = Int.from(Math.round(status.channelALevel));
        this.attributes.channelBLevel.value = Int.from(Math.round(status.channelBLevel));

        if (undefined !== this.attributes.pulseFrequency) {
            this.attributes.pulseFrequency.value = Int.from(Math.round(status.pulseFrequency));
        }

        if (undefined !== this.attributes.pulsePwm) {
            this.attributes.pulsePwm.value = Int.from(Math.round(status.pulsePwm));
        }

        this.attributes.highPowerMode.value = status.powerMode === 'H';
        this.attributes.channelsJoined.value = status.channelsJoined;
        this.attributes.batteryStatus.value = EStim2bDevice.humanReadableBatteryLevel(status.batteryLevel);
    }

    protected override async doRefresh(): Promise<void> {
        const status = await this.send(this.protocol.createGetStatusCommand());
        this.attributes = this.setModeBasedAttributes(status);
        this.updateAttributeValues(status);
    }

    private async send(command: Estim2bCommand): Promise<EStim2bStatus>
    {
        const encodedMessage = this.protocol.encode(command);
        const response = await this.transport.sendAndAwaitReceive(encodedMessage, EStim2bDevice.TRANSPORT_TIMEOUT_MS);
        const decodedResponse = this.protocol.decode(response);

        if ('error' in decodedResponse) {
            throw getErrorFromDecodeResult(decodedResponse.error, response);
        }

        return decodedResponse.message;
    }

    private setModeBasedAttributes(currentStatus: EStim2bStatus): EStim2bDeviceAttributes {
        let newAttributes: (Required<Pick<EStim2bDeviceAttributes, 'pulseFrequency'>>
            & Partial<Pick<EStim2bDeviceAttributes, 'pulsePwm'>>) | undefined;

        switch (currentStatus.currentMode) {
            case EStim2bMode.pulse:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('Pulse Feel', currentStatus),
                    pulsePwm: EStim2bDevice.createPulsePwmAttribute('Pulse PWM', currentStatus),
                };
                break;
            case EStim2bMode.bounce:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('Bounce Rate', currentStatus),
                    pulsePwm: EStim2bDevice.createPulsePwmAttribute('Pulse Feel', currentStatus),
                };
                break;
            case EStim2bMode.continuous:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('Pulse Feel', currentStatus),
                };
                break;
            case EStim2bMode.aSplit:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('B Pulse Rate', currentStatus),
                    pulsePwm: EStim2bDevice.createPulsePwmAttribute('Pulse Feel', currentStatus),
                };
                break;
            case EStim2bMode.bSplit:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('A Pulse Rate', currentStatus),
                    pulsePwm: EStim2bDevice.createPulsePwmAttribute('Pulse Feel', currentStatus),
                };
                break;
            case EStim2bMode.wave:
            case EStim2bMode.waterfall:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('Flow', currentStatus),
                    pulsePwm: EStim2bDevice.createPulsePwmAttribute('Granularity', currentStatus),
                };
                break;
            case EStim2bMode.squeeze:
            case EStim2bMode.milk:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('Pulse speed', currentStatus),
                    pulsePwm: EStim2bDevice.createPulsePwmAttribute('Feel', currentStatus),
                };
                break;
            case EStim2bMode.throb:
            case EStim2bMode.thrust:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('Range', currentStatus),
                };
                break;
            case EStim2bMode.random:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('Range', currentStatus),
                    pulsePwm: EStim2bDevice.createPulsePwmAttribute('Pulse Feel', currentStatus),
                };
                break;
            case EStim2bMode.step:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('Step Size', currentStatus),
                    pulsePwm: EStim2bDevice.createPulsePwmAttribute('Pulse Feel', currentStatus),
                };
                break;
            case EStim2bMode.training:
                newAttributes = {
                    pulseFrequency: EStim2bDevice.createPulseFrequencyAttribute('Jump Size', currentStatus),
                    pulsePwm: EStim2bDevice.createPulsePwmAttribute('Pulse Feel', currentStatus),
                };
                break;
            default:
                newAttributes = undefined;
        }

        if (undefined === newAttributes) {
            throw new Error();
        }

        return {
            mode: this.attributes.mode,
            channelALevel: this.attributes.channelALevel,
            channelBLevel: this.attributes.channelBLevel,
            ...newAttributes,
            channelsJoined: this.attributes.channelsJoined,
            highPowerMode: this.attributes.highPowerMode,
            batteryStatus: this.attributes.batteryStatus,
        };
    }

    private static createPulsePwmAttribute(label: string, currentStatus: EStim2bStatus): IntRangeDeviceAttribute {
        return IntRangeDeviceAttribute.createInitialized(
            'pulsePwm',
            label,
            DeviceAttributeModifier.readWrite,
            undefined,
            Int.from(EStim2bDevice.PULSE_ATTR_MIN),
            Int.from(EStim2bDevice.PULSE_ATTR_MAX),
            Int.from(1),
            Int.from(currentStatus.pulsePwm),
        );
    }

    private static createPulseFrequencyAttribute(label: string, currentStatus: EStim2bStatus): IntRangeDeviceAttribute {
        return IntRangeDeviceAttribute.createInitialized(
            'pulseFrequency',
            label,
            DeviceAttributeModifier.readWrite,
            undefined,
            Int.from(EStim2bDevice.PULSE_ATTR_MIN),
            Int.from(EStim2bDevice.PULSE_ATTR_MAX),
            Int.from(1),
            Int.from(currentStatus.pulseFrequency),
        );
    }
}
