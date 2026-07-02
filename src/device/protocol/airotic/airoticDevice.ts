import { Exclude } from 'class-transformer';
import EventEmitter from 'events';
import { AttributeKeyOf, AttributeValueOf, DeviceEvent } from '../../device.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import { NoDeviceConfig } from '../../deviceConfig.js';
import { Peripheral } from '@stoprocent/noble';
import { DeviceId } from '../../deviceId.js';
import Logger from '../../../logging/Logger.js';
import BleDevice from '../../bleDevice.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import AiroticProtocol from './airtonicProtocol.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import { sleep } from '../../../util/async.js';
import BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import { logError } from '../../../util/error.js';
import { Float } from '../../../util/numbers.js';

const BREATH_WINDOW_MS = 60_000;
const BREATH_TIMEOUT_MS = 20_000;
const BPM_TREND_INTERVALS = 6;
const BPM_TREND_THRESHOLD = 0.10;

export type BpmTrend = 'up' | 'down' | 'stable';

export type AiroticDeviceAttributes = {
    restColor: StrDeviceAttribute,
    breathInColor: StrDeviceAttribute,
    resetColors: BoolDeviceAttribute,
    reboot: BoolDeviceAttribute,
    breathsPerMin: FloatDeviceAttribute,
    bpmTrend: StrDeviceAttribute,
};

export type AiroticDeviceNotifications = {
    colorChange: {
        colorType: 'breathInColor' | 'restColor';
    };
};

@Exclude()
export default class AiroticDevice extends BleDevice<AiroticDeviceAttributes, AiroticDeviceNotifications, NoDeviceConfig>
{
    private readonly messageResponseHandler: MessageResponseHandler<AiroticProtocol>;

    private readonly transport: BleUartDeviceTransport;

    private readonly breathTimestamps: number[] = [];

    private breathTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

    public constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        peripheral: Peripheral,
        transport: BleUartDeviceTransport,
        messageResponseHandler: MessageResponseHandler<AiroticProtocol>,
        connectedSince: Date,
        controllable: boolean,
        attributes: AiroticDeviceAttributes,
        config: NoDeviceConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceId, deviceName, provider, peripheral, connectedSince, controllable, attributes, config, eventEmitter, logger);

        this.transport = transport;
        this.messageResponseHandler = messageResponseHandler;

        this.transport.onConnected(() => {
            this.syncState().catch(
                (e: unknown) => logError(this.logger, `Error syncing state after reconnect for device ${this.deviceId}`, e)
            );
        });

        this.transport.onReceive(data => this.onReceiveTransportData(data));
    }

    private onReceiveTransportData(data: Buffer): void {
        const dataStr = data.toString('utf-8');
        if ('*B' !== dataStr && '*R' !== dataStr) {
            return;
        }

        // *B = Breath In Color, *R = Rest Color

        this.logger.debug(`Received data from device ${this.deviceId}: ${dataStr}`);

        this.emit(DeviceEvent.deviceNotification, {
            type: 'colorChange',
            data: {
                colorType: dataStr === '*B' ? 'breathInColor' : 'restColor',
            },
        });

        if (dataStr === '*B') {
            this.recordBreath();
        }
    }

    private recordBreath(): void {
        const now = Date.now();

        this.breathTimestamps.push(now);

        this.resetBreathTimeout();
        this.recalculateBreathsPerMin();
        this.updateLastRefresh();
    }

    private resetBreathTimeout(): void {
        if (this.breathTimeoutHandle !== null) {
            clearTimeout(this.breathTimeoutHandle);
        }

        this.breathTimeoutHandle = setTimeout(() => {
            this.breathTimestamps.length = 0;
            this.attributes.breathsPerMin.value = undefined;
            this.attributes.bpmTrend.value = undefined;
            this.updateLastRefresh();
            this.breathTimeoutHandle = null;
        }, BREATH_TIMEOUT_MS);
    }

    private recalculateBreathsPerMin(): void {
        const now = Date.now();
        const cutoff = now - BREATH_WINDOW_MS;

        while (this.breathTimestamps.length > 0 && this.breathTimestamps[0] < cutoff) {
            this.breathTimestamps.shift();
        }

        if (this.breathTimestamps.length < 2) {
            return;
        }

        const timestamps = this.breathTimestamps;
        const windowMs = timestamps[timestamps.length - 1] - timestamps[0];
        const n = timestamps.length - 1;

        const bpm = Math.round(((60_000 * n) / windowMs) * 10) / 10;

        this.attributes.breathsPerMin.value = Float.from(bpm);
        this.attributes.bpmTrend.value = this.recalculateBpmTrend();
    }

    private recalculateBpmTrend(): BpmTrend | undefined {
        const ts = this.breathTimestamps;

        // Need BPM_TREND_INTERVALS intervals = BPM_TREND_INTERVALS + 1 timestamps
        if (ts.length < BPM_TREND_INTERVALS + 1) {
            return undefined;
        }

        const relevant = ts.slice(-(BPM_TREND_INTERVALS + 1));
        const intervals: number[] = [];

        for (let i = 1; i < relevant.length; i++) {
            intervals.push(relevant[i] - relevant[i - 1]);
        }

        const half = intervals.length / 2;
        const prevIntervals = intervals.slice(0, half);
        const recentIntervals = intervals.slice(half);

        const avgPrev = prevIntervals.reduce((a, b) => a + b, 0) / prevIntervals.length;
        const avgRecent = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;

        // Shorter interval = faster breathing, so change sign is inverted
        const change = (avgRecent - avgPrev) / avgPrev;

        if (change < -BPM_TREND_THRESHOLD) return 'up';
        if (change > BPM_TREND_THRESHOLD) return 'down';
        return 'stable';
    }

    protected async syncState(): Promise<void> {
        const { restColor, breathInColor } = this.attributes;

        if (undefined !== restColor.value) {
            const { r, g, b } = this.parseColor(restColor.value);
            await this.messageResponseHandler.send(AiroticProtocol.createSelectRestColorMessage());
            await sleep(100);
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
        }

        if (undefined !== breathInColor.value) {
            const { r, g, b } = this.parseColor(breathInColor.value);
            await this.messageResponseHandler.send(AiroticProtocol.createSelectBreathInColorMessage());
            await sleep(100);
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
        }
    }

    public async setAttribute<K extends AttributeKeyOf<AiroticDeviceAttributes>, V extends AttributeValueOf<K>>(attributeName: K, value: V): Promise<V> {
        if (attributeName === 'restColor' && value !== null && typeof value === 'string') {
            const { r, g, b } = this.parseColor(value);
            await this.messageResponseHandler.send(AiroticProtocol.createSelectRestColorMessage());
            await sleep(100);
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
            this.attributes.restColor.value = value;
            return value;
        }

        if (attributeName === 'breathInColor' && value !== null && typeof value === 'string') {
            const { r, g, b } = this.parseColor(value);
            await this.messageResponseHandler.send(AiroticProtocol.createSelectBreathInColorMessage());
            await sleep(100);
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
            this.attributes.breathInColor.value = value;
            return value;
        }

        if (attributeName === 'resetColors' && typeof value === 'boolean') {
            if (value) {
                await this.messageResponseHandler.send(AiroticProtocol.createResetColorsMessage());
            }
            return value;
        }

        if (attributeName === 'reboot' && typeof value === 'boolean') {
            if (value) {
                await this.messageResponseHandler.send(AiroticProtocol.createRebootMessage());
                await sleep(500);
                await this.close();
            }

            return value;
        }

        throw new Error(`Unknown attribute '${attributeName}' or invalid value type`);
    }

    public override async doClose(): Promise<void> {
        if (this.breathTimeoutHandle !== null) {
            clearTimeout(this.breathTimeoutHandle);
            this.breathTimeoutHandle = null;
        }

        await super.doClose();
        await this.transport.close();
    }

    private parseColor(value: string): { r: number, g: number, b: number } {
        const channels = value.split(',');

        if (channels.length !== 3) {
            throw new Error(`Invalid color format: expected 3 components, got ${channels.length}`);
        }

        const [r, g, b] = channels.map(c => {
            const channelNumber = parseInt(c, 10);

            if (isNaN(channelNumber) || channelNumber < 0 || channelNumber > 255) {
                throw new Error(`Invalid color channel value: ${c}`);
            }

            return channelNumber;
        });

        return { r, g, b };
    }
}
