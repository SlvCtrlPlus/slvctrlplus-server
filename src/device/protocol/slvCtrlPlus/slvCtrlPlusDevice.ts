import {Exclude} from "class-transformer";
import Device from "../../device.js";
import DeviceTransport from "../../transport/deviceTransport.js";
import EventEmitter from "events";

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
        eventEmitter: EventEmitter,
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, eventEmitter);
        this.transport = transport;
    }

    protected getSerialTimeout(): number {
        return 0;
    }

    protected async send(command: string): Promise<string> {
        return await this.transport.writeLineAndExpect(command, this.getSerialTimeout());
    }
}
