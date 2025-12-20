import DeviceManager from "../deviceManager.js";
import EventEmitter from "events";
import Device, {DeviceData} from "../device.js";
import DeviceProviderEvent from "./deviceProviderEvent.js";
import DeviceState from "../deviceState.js";
import Logger from "../../logging/Logger.js";

export default abstract class DeviceProvider
{
    protected readonly eventEmitter: EventEmitter;

    protected readonly logger: Logger;

    protected constructor(eventEmitter: EventEmitter, logger: Logger) {
        this.eventEmitter = eventEmitter;
        this.logger = logger;
    }

    public abstract init(deviceManager: DeviceManager): Promise<void>;

    public on(event: DeviceProviderEvent, listener: (device: Device) => void): DeviceProvider
    {
        this.eventEmitter.on(event, listener);

        return this;
    }

    protected initDeviceStatusUpdater<T extends DeviceData>(device: Device<T>): NodeJS.Timeout
    {
        const deviceStatusUpdater = () => {
            if (device.getState === DeviceState.busy) {
                this.logger.trace(`Device not refreshed since it's currently busy: ${device.getDeviceId}`)
                return;
            }

            device.refreshData().then(() => device.updateLastRefresh()).catch(
                (e: Error) => this.logger.error(`device: ${device.getDeviceId} -> status -> failed: ${e.message}`)
            );

            this.eventEmitter.emit(DeviceProviderEvent.deviceRefreshed, device);

            this.logger.trace(`Device refreshed: ${device.getDeviceId}`)
        };

        deviceStatusUpdater();

        return setInterval(deviceStatusUpdater, device.getRefreshInterval);
    }
}
