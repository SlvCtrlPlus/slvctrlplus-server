import {Exclude} from "class-transformer";
import Device from "./device.js";
import DeviceTransport from "./transport/deviceTransport.js";

@Exclude()
export default abstract class SlvCtrlPlusDevice extends Device
{
    protected readonly transport: DeviceTransport;

    protected constructor(
        deviceId: string,
        deviceName: string,
        connectedSince: Date,
        transport: DeviceTransport,
        controllable: boolean
    ) {
        super(deviceId, deviceName, connectedSince, controllable);
        this.transport = transport;
    }

    protected parseDataStr(data: string): { [key: string]: string }|null {
        const dataParts: string[] = data.split(';');

        if ('status' !== dataParts.shift()) {
            return null;
        }

        const dataObj: { [key: string]: string } = {};

        for (const dataPart of dataParts.shift().split(',')) {
            const [key, value]: string[] = dataPart.split(':');

            dataObj[key] = value;
        }

        return dataObj;
    }

    protected getSerialTimeout(): number {
        return 0;
    }

    protected async send(command: string): Promise<string> {
        return await this.transport.writeLineAndExpect(command, this.getSerialTimeout());
    }
}
