import {Exclude} from "class-transformer";
import Device from "../../device.js";
import DeviceTransport from "../../transport/deviceTransport.js";
import GenericDeviceAttribute from "../../attribute/genericDeviceAttribute.js";

@Exclude()
export default abstract class SlvCtrlPlusDevice extends Device
{
    protected readonly transport: DeviceTransport;

    protected constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        transport: DeviceTransport,
        controllable: boolean,
        attributes: GenericDeviceAttribute[]
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
