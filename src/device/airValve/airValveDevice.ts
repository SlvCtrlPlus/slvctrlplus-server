import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";
import {Exclude, Expose} from "class-transformer";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import SerialDevice from "../serialDevice.js";
import NumberDeviceOutput from "../numberDeviceOutput.js";
import NumberDeviceInput from "../numberDeviceInput.js";

type AirValveDeviceOutputs = {
    flow: NumberDeviceOutput<AirValveDevice>
};
type AirValveDeviceInputs = {
    flow: NumberDeviceInput<AirValveDevice>
};

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

            /*return this.send(`flow-set ${flow} ${duration}`)
                .then(() => {
                    this.flow = flow
                    this.state = DeviceState.ready;
                }).catch((err: Error) => {
                    this.logDeviceError(this, err)
                    this.state = DeviceState.ready;

                    throw err;
                });*/
           await this.send(`flow-set ${flow} ${duration}`);
           this.flow = flow;

           // return result;
       } catch (err) {
           this.logDeviceError(this, err)

            throw err;
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
            this.lastRefresh = new Date();
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
