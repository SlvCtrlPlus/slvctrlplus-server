import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";
import {Exclude, Expose} from "class-transformer";
import Device from "../device.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";

@Exclude()
export default class AirValveDevice extends Device
{
    @Expose()
    private readonly fwVersion: string;

    @Expose()
    private flow: number;

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
        this.flow = 100;
    }

    public async setFlow(flow: number, duration: number): Promise<void> {
        if (this.state === DeviceState.busy) {
            throw new Error(`Device ${this.deviceId} is currently busy`);
        }

        try {
            this.state = DeviceState.busy;

            const result = await this.syncPort.writeLineAndExpect(`flow-set ${flow} ${duration}`);
            console.log(result)
            this.flow = flow;
        } catch (err) {
            console.log(err);
        } finally {
            this.state = DeviceState.ready;
        }
    }

    public async refreshData(): Promise<void>
    {
        await this.syncPort.writeLineAndExpect('flow-get');
    }
}
