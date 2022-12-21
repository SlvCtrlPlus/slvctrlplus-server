import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";
import {Exclude, Expose} from "class-transformer";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import Et312DeviceData from "./et312DeviceData.js";
import SerialDevice from "../serialDevice.js";
import NumberDeviceOutput from "../numberDeviceOutput.js";
import NumberDeviceInput from "../numberDeviceInput.js";

type Et312DeviceOutputs = {
    levelA: NumberDeviceOutput<Et312Device>,
    levelB: NumberDeviceOutput<Et312Device>
}

type Et312DeviceInputs = {
    levelA: NumberDeviceInput<Et312Device>,
    levelB: NumberDeviceInput<Et312Device>
}

@Exclude()
export default class Et312Device extends SerialDevice
{
    private readonly serialTimeout = 500;

    @Expose()
    private readonly fwVersion: string;

    @Expose()
    private data: Et312DeviceData;

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
        this.data = new Et312DeviceData(false, true, 0, 0, 0);
    }

    public async setAdc(adcEnabled: boolean): Promise<void> {
        try {
            this.state = DeviceState.busy;

            const result = await this.send(adcEnabled ? `adc-enable` : `adc-disable`);
            console.log(result)
            // TODO maybe not needed
            // this.refreshData();
        } catch (err) {
            console.log(err);
        } finally {
            this.state = DeviceState.ready;
        }
    }

    public async setLevel(channel: string, level: number): Promise<void> {
        try {
            this.state = DeviceState.busy;

            const result = await this.send(`level-set ${channel} ${level}`);
            console.log(result);
        } catch (err) {
            console.log(err);
        } finally {
            this.state = DeviceState.ready;
        }
    }

    public async setMode(mode: number): Promise<void> {
        try {
            this.state = DeviceState.busy;

            const result = await this.send(`mode-set ${mode}`);
            console.log(result)
            // TODO maybe not needed
            // this.refreshData();
        } catch (err) {
            console.log(err);
        } finally {
            this.state = DeviceState.ready;
        }
    }

    protected getSerialTimeout(): number {
        return this.serialTimeout;
    }

    public get getRefreshInterval(): number {
        return 175;
    }

    public refreshData(): void
    {
        this.send('status').then((data) => {
            const dataObj = this.parseDataStr(data);

            if (null === dataObj) {
                return;
            }

            const deviceData = {...{
                connected: '0',
                adc: '1',
                levelA: '0',
                levelB: '0',
                mode: '0',
            }, ...dataObj};

            this.data = new Et312DeviceData(
                deviceData.connected === '1',
                deviceData.adc === '1',
                Number(deviceData.mode),
                Number(deviceData.levelA),
                Number(deviceData.levelB)
            )
            this.lastRefresh = new Date();
        }).catch(console.log);
    }

    public static getOutputs(): Et312DeviceOutputs {
        return {
            levelA: new NumberDeviceOutput((device: Et312Device): number => device.data.getLevelA, 0, 99),
            levelB: new NumberDeviceOutput((device: Et312Device): number => device.data.getLevelB, 0, 99),
        };
    }

    public static getInputs(): Et312DeviceInputs {
        return {
            levelA: new NumberDeviceInput(
                (device: Et312Device, value: number): Promise<void> => device.setLevel('A', value), 0, 99
            ),
            levelB: new NumberDeviceInput(
                (device: Et312Device, value: number): Promise<void> => device.setLevel('B', value), 0, 99
            ),
        };
    }
}
