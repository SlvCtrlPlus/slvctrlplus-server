import Device, { ExtractAttributeValue } from '../../device.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import EStim2bProtocol, { EStim2bMode, EStim2bStatus } from './estim2bProtocol.js';
import { Exclude, Expose } from 'class-transformer';
import { Int } from '../../../util/numbers.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';

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
export default class EStim2bDevice extends Device<EStim2bDeviceAttributes>
{
    private readonly protocol: EStim2bProtocol;

    @Expose()
    private readonly fwVersion: string;

    public constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean,
        status: EStim2bStatus,
        protocol: EStim2bProtocol,
        attributes: EStim2bDeviceAttributes
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes, {});

        this.protocol = protocol;
        this.fwVersion = status.firmwareVersion;
        this.attributes = this.setModeBasedAttributes(status);
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

    public async refreshData(): Promise<void> {
        this.updateAttributeValues(await this.protocol.requestStatus());
    }

    public async setAttribute<
        K extends keyof EStim2bDeviceAttributes,
        V extends ExtractAttributeValue<EStim2bDeviceAttributes[K]>
    >(attributeName: K, value: V): Promise<V> {
        const attribute = this.attributes[attributeName]

        if (undefined === attribute) {
            throw new Error(`Attribute '${attributeName}' does not exist`);
        }

        let result;

        if ('mode' === attributeName && this.attributes.mode.isValidValue(value)) {
            result = await this.protocol.setMode(value);
            this.attributes = this.setModeBasedAttributes(result);
        } else if ('channelALevel' === attributeName && this.attributes.channelALevel.isValidValue(value)) {
            result = await this.protocol.setPower('A', value);
        } else if ('channelBLevel' === attributeName && this.attributes.channelBLevel.isValidValue(value)) {
            result = await this.protocol.setPower('B', value);
        } else if ('pulseFrequency' === attributeName && this.attributes.pulseFrequency!.isValidValue(value)) {
            result = await this.protocol.setPulseFrequency(value);
        } else if ('pulsePwm' === attributeName && this.attributes.pulsePwm!.isValidValue(value)) {
            result = await this.protocol.setPulsePwm(value);
        } else if ('highPowerMode' === attributeName && this.attributes.highPowerMode.isValidValue(value)) {
            result = await this.protocol.setPowerMode(value ? 'H' : 'L');
        } else {
            throw new Error(
                `Could not set value ${JSON.stringify(value)} (type: ${typeof value}) for attribute '${attributeName}'`
            );
        }

        if (undefined !== result) {
            this.updateAttributeValues(result);
        }

        return attribute.value as V;
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
