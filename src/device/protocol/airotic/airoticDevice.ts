import { Exclude } from 'class-transformer';
import type EventEmitter from 'events';
import type { AttributeKeyOf, AttributeValueOf, DeviceInfo } from '../../device.js';
import { DeviceEvent } from '../../device.js';
import type StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import type { NoDeviceConfig } from '../../deviceConfig.js';
import type { Peripheral } from '@stoprocent/noble';
import type Logger from '../../../logging/Logger.js';
import BleDevice from '../../bleDevice.js';
import type MessageResponseHandler from '../messageResponseHandler.js';
import AiroticProtocol from './airoticProtocol.js';
import type BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import type FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import { sleep } from '../../../util/async.js';
import type BleUartDeviceTransport from '../../transport/bleDeviceTransport.js';
import { Float, HALF_FACTOR, MIN_AS_SECONDS, SECOND_AS_MILLISECONDS } from '../../../util/numbers.js';
import typeDetect from 'type-detect';
import { hasExactLength } from '../../../util/typeUtils.js';
import { BYTE_MAX } from '../../../util/numbers.js';

const BREATH_WINDOW_MS = 60_000;
const BREATH_TIMEOUT_MS = 20_000;
const BPM_TREND_INTERVALS = 6;
const BPM_TREND_THRESHOLD = 0.10;
const DEFAULT_REST_COLOR = `0,0,${BYTE_MAX}`;
const DEFAULT_BREATH_IN_COLOR = `${BYTE_MAX},0,128`;
const SLEEP_BETWEEN_COMMANDS_MS = 100;
const COLOR_CHANNELS = 3;

export type BpmTrend = 'up' | 'down' | 'stable';

export type AiroticDeviceAttributes = {
    restColor: StrDeviceAttribute;
    breathInColor: StrDeviceAttribute;
    resetColors: BoolDeviceAttribute;
    reboot: BoolDeviceAttribute;
    breathsPerMin: FloatDeviceAttribute;
    bpmTrend: StrDeviceAttribute;
};

export type AiroticDeviceNotifications = {
    colorChange: {
        colorType: 'breathInColor' | 'restColor';
    };
};

@Exclude()
export default class AiroticDevice extends BleDevice<AiroticDeviceAttributes, AiroticDeviceNotifications>
{
    private static readonly BREATHS_MIN_SAMPLE_COUNT = 2;

    private readonly messageResponseHandler: MessageResponseHandler<AiroticProtocol>;

    private readonly transport: BleUartDeviceTransport;

    private readonly breathTimestamps: number[] = [];

    private breathTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

    public constructor(
        deviceInfo: DeviceInfo,
        peripheral: Peripheral,
        transport: BleUartDeviceTransport,
        messageResponseHandler: MessageResponseHandler<AiroticProtocol>,
        attributes: AiroticDeviceAttributes,
        config: NoDeviceConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, peripheral, attributes, config, eventEmitter, logger);

        this.transport = transport;
        this.messageResponseHandler = messageResponseHandler;

        this.transport.onReceive(data => this.onReceiveTransportData(data));
    }

    public async setAttribute<
        K extends AttributeKeyOf<AiroticDeviceAttributes>,
        V extends AttributeValueOf<AiroticDeviceAttributes, K>,
    >(attributeName: K, value: V): Promise<V> {
        if (attributeName === 'restColor' && value !== undefined && typeof value === 'string') {
            const { r, g, b } = AiroticDevice.parseColor(value);
            await this.messageResponseHandler.send(AiroticProtocol.createSelectRestColorMessage());
            await sleep(SLEEP_BETWEEN_COMMANDS_MS);
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
            this.attributes.restColor.value = value;
            return value;
        }

        if (attributeName === 'breathInColor' && value !== undefined && typeof value === 'string') {
            const { r, g, b } = AiroticDevice.parseColor(value);
            await this.messageResponseHandler.send(AiroticProtocol.createSelectBreathInColorMessage());
            await sleep(SLEEP_BETWEEN_COMMANDS_MS);
            await this.messageResponseHandler.send(AiroticProtocol.createSetColorMessage(r, g, b));
            this.attributes.breathInColor.value = value;
            return value;
        }

        if (attributeName === 'resetColors' && typeof value === 'boolean') {
            if (value) {
                await this.messageResponseHandler.send(AiroticProtocol.createResetColorsMessage());
                this.attributes.restColor.value = DEFAULT_REST_COLOR;
                this.attributes.breathInColor.value = DEFAULT_BREATH_IN_COLOR;
                this.updateLastRefresh();
            }
            return value;
        }

        if (attributeName === 'reboot' && typeof value === 'boolean') {
            if (value) {
                await this.messageResponseHandler.send(AiroticProtocol.createRebootMessage());
                await sleep(SLEEP_BETWEEN_COMMANDS_MS);
                await this.close();
            }

            return value;
        }

        throw new Error(`Unknown attribute '${attributeName}' or invalid value type '${typeDetect(value)}'`);
    }

    public override async doClose(): Promise<void> {
        if (this.breathTimeoutHandle !== null) {
            clearTimeout(this.breathTimeoutHandle);
            this.breathTimeoutHandle = null;
        }

        await super.doClose();
        await this.transport.close();
    }

    private onReceiveTransportData(data: Buffer): void {
        const dataStr = data.toString('utf-8');
        if ('*B' !== dataStr && '*R' !== dataStr) {
            return;
        }

        // *B = Breath In Color, *R = Rest Color

        this.logger.trace(`Received data from device ${this.deviceId}: ${dataStr}`);

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

        let first = this.breathTimestamps[0];

        while (first !== undefined && first < cutoff) {
            this.breathTimestamps.shift();
            first = this.breathTimestamps[0];
        }

        if (this.breathTimestamps.length < AiroticDevice.BREATHS_MIN_SAMPLE_COUNT) {
            return;
        }

        const timestamps = this.breathTimestamps;
        const firstTimestamp = timestamps[0];
        const lastTimestamp = timestamps[timestamps.length - 1];

        if (undefined === firstTimestamp || undefined === lastTimestamp) {
            return;
        }

        const windowMs = lastTimestamp - firstTimestamp;
        const n = timestamps.length - 1;

        const bpm = Math.round(((MIN_AS_SECONDS * SECOND_AS_MILLISECONDS * n) / windowMs) * 10) / 10;

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
        let previous = relevant[0];

        if (previous === undefined) {
            return undefined;
        }

        for (const current of relevant.slice(1)) {
            intervals.push(current - previous);
            previous = current;
        }

        const half = intervals.length * HALF_FACTOR;
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

    private static parseColor(value: string): { r: number, g: number, b: number } {
        const channels = value.split(',');

        if (!hasExactLength(channels, COLOR_CHANNELS)) {
            throw new Error(`Invalid color format: expected ${COLOR_CHANNELS} components, got ${channels.length}`);
        }

        const [r, g, b] = channels.map(c => {
            const channelNumber = parseInt(c, 10);

            if (isNaN(channelNumber) || channelNumber < 0 || channelNumber > BYTE_MAX) {
                throw new Error(`Invalid color channel value: ${c}`);
            }

            return channelNumber;
        });

        if (r === undefined || g === undefined || b === undefined) {
            throw new Error(`Could not parse color value: ${value}`);
        }

        return { r, g, b };
    }
}
