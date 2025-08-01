import {Exclude} from "class-transformer";
import Device from "../../device.js";
import GenericDeviceAttribute from "../../attribute/genericDeviceAttribute.js";
import {Zc95Messages} from "./Zc95Messages";

@Exclude()
export default abstract class Zc95Device extends Device
{
    protected readonly transport: Zc95Messages;

    public constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        transport: Zc95Messages,
        controllable: boolean,
        attributes: GenericDeviceAttribute[]
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes);
        this.transport = transport;
    }

    protected getSerialTimeout(): number {
        return 0;
    }

    /*protected async send(command: string): Promise<string> {
        return await this.transport.sendAndAwaitReceive(command + "\n", this.getSerialTimeout());
    }*/
}
