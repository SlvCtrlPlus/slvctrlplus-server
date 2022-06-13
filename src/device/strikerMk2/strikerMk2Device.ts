import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";
import {Exclude, Expose} from "class-transformer";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import SerialDevice from "../serialDevice.js";
import StrikerMk2DeviceData from "./strikerMk2DeviceData.js";

@Exclude()
export default class StrikerMk2Device extends SerialDevice
{
    private readonly serialTimeout = 250;

    @Expose()
    private readonly fwVersion: string;

    @Expose()
    private data: StrikerMk2DeviceData;

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
        this.data = new StrikerMk2DeviceData(0);
    }

    public async setSpeed(speed: number): Promise<void> {
        try {
            this.state = DeviceState.busy;

            const result = await this.syncPort.writeLineAndExpect(`speed-set ${speed}`);
            console.log(result)
            this.refreshData();
        } catch (err) {
            console.log(err);
        } finally {
            this.state = DeviceState.ready;
        }
    }

    public refreshData(): void
    {
        this.send('status').then((data) => {
            const dataObj = this.parseDataStr(data);

            if (null === dataObj) {
                return;
            }

            const deviceData = {...{
                    speed: '0',
                }, ...dataObj};

            this.data = new StrikerMk2DeviceData(Number(deviceData.speed))
        }).catch(console.log);
    }

    private parseDataStr(data: string): { [key: string]: string }|null {
        const dataParts: string[] = data.split(',');

        if ('status' !== dataParts.shift()) {
            return null;
        }

        const dataObj: { [key: string]: string } = {};

        for (const dataPart of dataParts) {
            const [key, value]: string[] = dataPart.split(':');
            dataObj[key] = value;
        }

        return dataObj;
    }

    private send(command: string): Promise<string> {
        return this.syncPort.writeLineAndExpect(command, this.serialTimeout);
    }
}
