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
        this.send('status').then(data => {
            const dataObj = this.parseDataStr(data);

            if (null === dataObj) {
                return;
            }

            this.flow = Number(dataObj.flow);
            this.updateLastRefresh();
        }).catch((e: Error) => this.logDeviceError(this, e));
    }

    public get getRefreshInterval(): number {
        return 175;
    }

    public static getInputs(): AirValveDeviceInputs {
        return {
            flow: new NumberDeviceInput(
                (device: AirValveDevice, value: number): Promise<void> => device.setFlow(value, 0), 0, 100, '%'
            )
        };
    }

    public static getOutputs(): AirValveDeviceOutputs {
        return {
            flow: new NumberDeviceOutput((device: AirValveDevice): number => device.flow, 0, 100, '%')
        };
    }
}
