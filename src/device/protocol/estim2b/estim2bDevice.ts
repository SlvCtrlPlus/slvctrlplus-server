import type { DeviceDataApplyError, DeviceDataUpdate, DeviceInfo } from '../../device.js';
import type { Estim2bCommand, EStim2bStatus } from './estim2bProtocol.js';
import type EStim2bProtocol from './estim2bProtocol.js';
import type { EStim2bMode } from './estim2bProtocol.js';
import { Exclude, Expose } from 'class-transformer';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import PeripheralDevice from '../../peripheralDevice.js';
import { getErrorFromDecodeResult } from '../deviceProtocol.js';
import type EventEmitter from 'events';
import type Logger from '../../../logging/Logger.js';
import type { TSchema } from '@sinclair/typebox';
import type JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';
import { estim2bAttributesSchema, getPulseConfigForMode } from './estim2bAttributesSchema.js';
import type { EStim2bAttributeValues } from './estim2bAttributesSchema.js';

export type EStim2bBatteryStatus = 'mains' | 'full' | 'medium' | 'low' | 'critical';

@Exclude()
export default class EStim2bDevice extends PeripheralDevice<EStim2bProtocol, EStim2bAttributeValues>
{
    private static readonly REFRESH_INTERVAL_MS = 175;
    private static readonly TRANSPORT_TIMEOUT_MS = 250;
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
        attributesSchema: TSchema,
        attributes: EStim2bAttributeValues,
        validatorFactory: JsonSchemaValidatorFactory,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, protocol, transport, attributesSchema, attributes, validatorFactory, {}, eventEmitter, logger);

        this.fwVersion = status.firmwareVersion;

        // Apply initial mode-based schema + values
        this.rebuildSchemaForMode(status.currentMode);
        this.updateAttributeValuesFromStatus(status);
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

    // eslint-disable-next-line complexity
    protected override async applyDeviceData(update: DeviceDataUpdate<EStim2bAttributeValues>): Promise<DeviceDataApplyError[]> {
        const errors: DeviceDataApplyError[] = [];

        if ('mode' in update && update.mode !== undefined) {
            try {
                const result = await this.sendCommand(this.protocol.createSetModeCommand(update.mode));
                this.rebuildSchemaForMode(result.currentMode);
                this.updateAttributeValuesFromStatus(result);
            } catch (e: unknown) {
                errors.push({ path: '/mode', message: e instanceof Error ? e.message : String(e) });
            }
        }

        if ('channelALevel' in update && update.channelALevel !== undefined) {
            try {
                const result = await this.sendCommand(this.protocol.createSetPowerCommand('A', update.channelALevel));
                this.updateAttributeValuesFromStatus(result);
            } catch (e: unknown) {
                errors.push({ path: '/channelALevel', message: e instanceof Error ? e.message : String(e) });
            }
        }

        if ('channelBLevel' in update && update.channelBLevel !== undefined) {
            try {
                const result = await this.sendCommand(this.protocol.createSetPowerCommand('B', update.channelBLevel));
                this.updateAttributeValuesFromStatus(result);
            } catch (e: unknown) {
                errors.push({ path: '/channelBLevel', message: e instanceof Error ? e.message : String(e) });
            }
        }

        if ('pulseFrequency' in update && update.pulseFrequency !== undefined) {
            try {
                const result = await this.sendCommand(this.protocol.createSetPulseFrequencyCommand(update.pulseFrequency));
                this.updateAttributeValuesFromStatus(result);
            } catch (e: unknown) {
                errors.push({ path: '/pulseFrequency', message: e instanceof Error ? e.message : String(e) });
            }
        }

        if ('pulsePwm' in update && update.pulsePwm !== undefined) {
            try {
                const result = await this.sendCommand(this.protocol.createSetPulsePwmCommand(update.pulsePwm));
                this.updateAttributeValuesFromStatus(result);
            } catch (e: unknown) {
                errors.push({ path: '/pulsePwm', message: e instanceof Error ? e.message : String(e) });
            }
        }

        if ('highPowerMode' in update && update.highPowerMode !== undefined) {
            try {
                const result = await this.sendCommand(this.protocol.createSetPowerModeCommand(update.highPowerMode ? 'H' : 'L'));
                this.updateAttributeValuesFromStatus(result);
            } catch (e: unknown) {
                errors.push({ path: '/highPowerMode', message: e instanceof Error ? e.message : String(e) });
            }
        }

        return errors;
    }

    protected override async doRefresh(): Promise<void> {
        const status = await this.sendCommand(this.protocol.createGetStatusCommand());
        this.rebuildSchemaForMode(status.currentMode);
        this.updateAttributeValuesFromStatus(status);
    }

    private updateAttributeValuesFromStatus(status: EStim2bStatus): void {
        this.data.mode = status.currentMode;
        this.data.channelALevel = Math.round(status.channelALevel);
        this.data.channelBLevel = Math.round(status.channelBLevel);

        if ('pulseFrequency' in this.data) {
            this.data.pulseFrequency = Math.round(status.pulseFrequency);
        }

        if ('pulsePwm' in this.data) {
            this.data.pulsePwm = Math.round(status.pulsePwm);
        }

        this.data.highPowerMode = status.powerMode === 'H';
        this.data.channelsJoined = status.channelsJoined;
        this.data.batteryStatus = EStim2bDevice.humanReadableBatteryLevel(status.batteryLevel);
    }

    private rebuildSchemaForMode(mode: EStim2bMode): void {
        const pulseConfig = getPulseConfigForMode(mode);

        if (undefined === pulseConfig) {
            throw new Error(`Unknown EStim2b mode: ${mode}`);
        }

        const newSchema = estim2bAttributesSchema(pulseConfig);
        this.updateAttributesSchema(newSchema);

        // If pulsePwm was removed from schema but exists in data, clean it up
        if (pulseConfig.pulsePwmLabel === undefined && 'pulsePwm' in this.data) {
            delete this.data.pulsePwm;
        }

        // If pulseFrequency/pulsePwm were added to schema but don't exist in data, seed them
        if (!('pulseFrequency' in this.data)) {
            this.data.pulseFrequency = 0;
        }

        if (pulseConfig.pulsePwmLabel !== undefined && !('pulsePwm' in this.data)) {
            this.data.pulsePwm = 0;
        }
    }

    private async sendCommand(command: Estim2bCommand): Promise<EStim2bStatus>
    {
        const encodedMessage = this.protocol.encode(command);
        const response = await this.transport.sendAndAwaitReceive(encodedMessage, EStim2bDevice.TRANSPORT_TIMEOUT_MS);
        const decodedResponse = this.protocol.decode(response);

        if ('error' in decodedResponse) {
            throw getErrorFromDecodeResult(decodedResponse.error, response);
        }

        return decodedResponse.message;
    }
}
