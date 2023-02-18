import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";
import {Exclude, Expose} from "class-transformer";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import SerialDevice from "../serialDevice.js";
import DistanceDeviceData from "./distanceDeviceData.js";
import NumberDeviceOutput from "../numberDeviceOutput.js";

type DistanceDeviceOutputs = {
    distance: NumberDeviceOutput<DistanceDevice>
};

@Exclude()
export default class DistanceDevice extends SerialDevice
{
    private readonly serialTimeout = 0;

    @Expose()
    private readonly fwVersion: string;

    @Expose()
    private data: DistanceDeviceData;

    public constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        connectedSince: Date,
        syncPort: SynchronousSerialPort,
        portInfo: PortInfo
    ) {
        super(deviceId, deviceName, connectedSince, syncPort, portInfo, false);

        this.fwVersion = fwVersion;
        this.data = new DistanceDeviceData('unknown', 255, 0);
    }

    protected getSerialTimeout(): number {
        return this.serialTimeout;
    }

    public refreshData(): void
    {
        this.send('status').then(data => {
            const dataObj = this.parseDataStr(data);

            if (null === dataObj) {
                return;
            }

            const deviceData = {...{
                    sensor: 'unknown',
                    distance: '255',
                    lux: '0',
                }, ...dataObj};

            this.data = new DistanceDeviceData(deviceData.sensor, Number(deviceData.distance), Number(deviceData.lux));
            this.updateLastRefresh();
        }).catch((e: Error) => this.logDeviceError(this, e));
    }

    public get getRefreshInterval(): number {
        return 175;
    }

    public static getOutputs(): DistanceDeviceOutputs {
        return {
            distance: new NumberDeviceOutput((device: DistanceDevice): number => {
                const rawDistance = device.data.getDistance;
                return rawDistance <= 183 ? rawDistance : 183;
            }, 0, 183, 'mm')
        };
    }
}
