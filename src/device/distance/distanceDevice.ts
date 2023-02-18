import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";
import {Exclude, Expose} from "class-transformer";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import SerialDevice from "../serialDevice.js";
import DistanceDeviceData from "./distanceDeviceData.js";

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

    public refreshData(): void
    {
        this.send('status').then((data) => {
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

    private send(command: string): Promise<string> {
        return this.syncPort.writeLineAndExpect(command, this.serialTimeout);
    }
}
