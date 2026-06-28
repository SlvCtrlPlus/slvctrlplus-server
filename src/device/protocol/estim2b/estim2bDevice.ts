import { AttributeKeyOf, AttributeValueOf } from '../../device.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import EStim2bProtocol, { Estim2bCommand, EStim2bMode, EStim2bStatus } from './estim2bProtocol.js';
import { Exclude, Expose } from 'class-transformer';
import { Int } from '../../../util/numbers.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import PeripheralDevice from '../../peripheralDevice.js';
import { getErrorFromDecodeResult } from '../deviceProtocol.js';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import { DeviceId } from '../../deviceId.js';

export type EStim2bDeviceAttributes = {
    mode: ListDeviceAttribute<Int, string>,
    channelALevel: IntRangeDeviceAttribute,
    channelBLevel: IntRangeDeviceAttribute,
    pulseFrequency?: IntRangeDeviceAttribute,
    pulsePwm?: IntRangeDeviceAttribute,
    channelsJoined: BoolDeviceAttribute,
    highPowerMode: BoolDeviceAttribute,
    batteryStatus: StrDeviceAttribute,
}

export type EStim2bBatteryStatus = 'mains' | 'full' | 'medium' | 'low' | 'critical';

@Exclude()
export default class EStim2bDevice extends PeripheralDevice<EStim2bProtocol, EStim2bDeviceAttributes>
{

    @Expose()
    private readonly fwVersion: string;

    private readonly logger: Logger;

    public constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean,
        status: EStim2bStatus,
        protocol: EStim2bProtocol,
        transport: DeviceBidirectionalTransport,
        attributes: EStim2bDeviceAttributes,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, protocol, transport, attributes, {}, eventEmitter);

        this.fwVersion = status.firmwareVersion;
        this.attributes = this.setModeBasedAttributes(status);
        this.logger = logger;
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

    public static humanReadableBatteryLevel(adc: number): EStim2bBatteryStatus {
        if (adc > 720) return 'mains';
        if (adc > 550) return 'full';
        if (adc > 525) return 'medium';
        if (adc > 500) return 'low';
        return 'critical';
    }

    protected override async doRefresh(): Promise<void> {
        const status = await this.send(this.protocol.createGetStatusCommand());
        this.attributes = this.setModeBasedAttributes(status);
        this.updateAttributeValues(status);
    }

    public override get getRefreshInterval(): number {
        return 175;
    }

    public async setAttribute<
        K extends AttributeKeyOf<EStim2bDeviceAttributes>
    >(attributeName: K, value: AttributeValueOf<K>): Promise<AttributeValueOf<K>> {
        const attribute = this.attributes[attributeName]

        if (undefined === attribute) {
            throw new Error(`Attribute '${attributeName}' does not exist`);
        }

        let result: EStim2bStatus;

        if ('mode' === attributeName && this.attributes.mode.isValidValue(value)) {
            result = await this.send(this.protocol.createSetModeCommand(value));
            this.attributes = this.setModeBasedAttributes(result);
        } else if ('channelALevel' === attributeName && this.attributes.channelALevel.isValidValue(value)) {
            result = await this.send(this.protocol.createSetPowerCommand('A', value));
        } else if ('channelBLevel' === attributeName && this.attributes.channelBLevel.isValidValue(value)) {
            result = await this.send(this.protocol.createSetPowerCommand('B', value));
        } else if ('pulseFrequency' === attributeName
            && undefined !== this.attributes.pulseFrequency
            && this.attributes.pulseFrequency.isValidValue(value)
        ) {
            result = await this.send(this.protocol.createSetPulseFrequencyCommand(value));
        } else if ('pulsePwm' === attributeName
            && undefined !== this.attributes.pulsePwm
            && this.attributes.pulsePwm.isValidValue(value)
        ) {
            result = await this.send(this.protocol.createSetPulsePwmCommand(value));
        } else if ('highPowerMode' === attributeName && this.attributes.highPowerMode.isValidValue(value)) {
            result = await this.send(this.protocol.createSetPowerModeCommand(value ? 'H' : 'L'));
        } else {
            throw new Error(
                `Could not set value ${JSON.stringify(value)} (type: ${typeof value}) for attribute '${attributeName}'`
            );
        }

        this.updateAttributeValues(result);

        return attribute.value;
    }

    private async send(command: Estim2bCommand): Promise<EStim2bStatus>
    {
        const encodedMessage = this.protocol.encode(command);
        const response = await this.transport.sendAndAwaitReceive(encodedMessage, 250);
        const decodedResponse = this.protocol.decode(response);

        if ('error' in decodedResponse) {
            throw getErrorFromDecodeResult(decodedResponse.error, response);
        }

        return decodedResponse.message;
    }

    private setModeBasedAttributes(currenStatus: EStim2bStatus): EStim2bDeviceAttributes {
        let newAttributes: (Required<Pick<EStim2bDeviceAttributes, 'pulseFrequency'>>
            & Partial<Pick<EStim2bDeviceAttributes, 'pulsePwm'>>) | undefined;

        switch (currenStatus.currentMode) {
            case EStim2bMode.pulse:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('Pulse Feel', currenStatus),
                    pulsePwm: this.createPulsePwmAttribute('Pulse PWM', currenStatus),
                }
                break;
            case EStim2bMode.bounce:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('Bounce Rate', currenStatus),
                    pulsePwm: this.createPulsePwmAttribute('Pulse Feel', currenStatus),
                };
                break;
            case EStim2bMode.continuous:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('Pulse Feel', currenStatus),
                };
                break;
            case EStim2bMode.aSplit:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('B Pulse Rate', currenStatus),
                    pulsePwm: this.createPulsePwmAttribute('Pulse Feel', currenStatus),
                };
                break;
            case EStim2bMode.bSplit:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('A Pulse Rate', currenStatus),
                    pulsePwm: this.createPulsePwmAttribute('Pulse Feel', currenStatus),
                };
                break;
            case EStim2bMode.wave:
            case EStim2bMode.waterfall:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('Flow', currenStatus),
                    pulsePwm: this.createPulsePwmAttribute('Granularity', currenStatus),
                };
                break;
            case EStim2bMode.squeeze:
            case EStim2bMode.milk:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('Pulse speed', currenStatus),
                    pulsePwm: this.createPulsePwmAttribute('Feel', currenStatus),
                };
                break;
            case EStim2bMode.throb:
            case EStim2bMode.thrust:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('Range', currenStatus),
                };
                break;
            case EStim2bMode.random:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('Range', currenStatus),
                    pulsePwm: this.createPulsePwmAttribute('Pulse Feel', currenStatus),
                };
                break;
            case EStim2bMode.step:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('Step Size', currenStatus),
                    pulsePwm: this.createPulsePwmAttribute('Pulse Feel', currenStatus),
                };
                break;
            case EStim2bMode.training:
                newAttributes = {
                    pulseFrequency: this.createPulseFrequencyAttribute('Jump Size', currenStatus),
                    pulsePwm: this.createPulsePwmAttribute('Pulse Feel', currenStatus),
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

    private createPulsePwmAttribute(label: string, currentStatus: EStim2bStatus): IntRangeDeviceAttribute {
        return IntRangeDeviceAttribute.createInitialized(
            'pulsePwm',
            label,
            DeviceAttributeModifier.readWrite,
            undefined,
            Int.from(2),
            Int.from(100),
            Int.from(1),
            Int.from(currentStatus.pulsePwm)
        );
    }

    private createPulseFrequencyAttribute(label: string, currentStatus: EStim2bStatus): IntRangeDeviceAttribute {
        return IntRangeDeviceAttribute.createInitialized(
            'pulseFrequency',
            label,
            DeviceAttributeModifier.readWrite,
            undefined,
            Int.from(2),
            Int.from(100),
            Int.from(1),
            Int.from(currentStatus.pulseFrequency)
        );
    }
}
