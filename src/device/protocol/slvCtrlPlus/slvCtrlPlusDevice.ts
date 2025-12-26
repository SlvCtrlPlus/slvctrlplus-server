import {Exclude} from "class-transformer";
import Device from "../../device.js";
import DeviceTransport from "../../transport/deviceTransport.js";
import DeviceAttribute from "../../attribute/deviceAttribute";

export type SlvCtrlPlusDeviceAttributeKey = string;
export type SlvCtrlPlusDeviceAttributes = Record<SlvCtrlPlusDeviceAttributeKey, DeviceAttribute>;

@Exclude()
export default abstract class SlvCtrlPlusDevice<A extends SlvCtrlPlusDeviceAttributes = SlvCtrlPlusDeviceAttributes> extends Device<A>
{
    protected readonly transport: DeviceTransport;

    protected constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        transport: DeviceTransport,
        controllable: boolean,
        attributes: A
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes);
        this.transport = transport;
    }

    protected getSerialTimeout(): number {
        return 0;
    }

    protected async send(command: string): Promise<string> {
        return await this.transport.sendAndAwaitReceive(command + "\n", this.getSerialTimeout());
    }
}
