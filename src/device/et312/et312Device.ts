import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";
import {Exclude, Expose} from "class-transformer";
import Device from "../device.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";

@Exclude()
export default class Et312Device extends Device
{
    @Expose()
    private readonly fwVersion: string;

    @Expose()
    private connected: boolean;

    public constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        connectedSince: Date,
        syncPort: SynchronousSerialPort,
        portInfo: PortInfo
    ) {
        super(deviceId, deviceName, connectedSince, syncPort, portInfo, true);

        this.fwVersion = fwVersion;
        this.connected = false;
    }

    /* public async setFlow(flow: number, duration: number): Promise<void> {
        if (this.state === DeviceState.Busy) {
            throw new Error(`Device ${this.deviceId} is currently busy`);
        }

        try {
            this.state = DeviceState.Busy;

            const result = await this.syncPort.writeLineAndExpect(`flow-set ${flow} ${duration}`);
            console.log(result)
            this.flow = flow;
        } catch (err) {
            console.log(err);
        } finally {
            this.state = DeviceState.Ready;
        }
    } */

    public async refreshData(): Promise<void>
    {
        await this.syncPort.writeLineAndExpect('flow-get');
    }
}
