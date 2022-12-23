import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";
import {Exclude, Expose} from "class-transformer";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import SerialDevice from "../serialDevice.js";

@Exclude()
export default class AirValveDevice extends SerialDevice
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

    public refreshData(): void
    {
        this.syncPort.writeLineAndExpect('flow-get').then(() => console.log).catch(console.log);
    }
}
