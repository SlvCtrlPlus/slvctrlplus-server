import SynchronousSerialPort from "../serial/SynchronousSerialPort.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import {Exclude, Expose} from "class-transformer";
import SerialDevice from "./serialDevice.js";
import GenericDeviceAttribute from "./generic/genericDeviceAttribute";

@Exclude()
export default class GenericDevice extends SerialDevice
{

    private readonly serialTimeout = 250;

    private attributes: Map<string, GenericDeviceAttribute> = new Map<string, GenericDeviceAttribute>();

    @Expose()
    private readonly fwVersion: string;

    public constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        connectedSince: Date,
        syncPort: SynchronousSerialPort,
        portInfo: PortInfo,
        attributes: GenericDeviceAttribute[]
    ) {
        super(deviceId, deviceName, connectedSince, syncPort, portInfo, false);

        this.setAttributes(attributes);
    }

    public refreshData(): void {
        // no-op
    }

    public async setAttribute(attributeName: string, value: string): Promise<void> {
        try {
            this.state = DeviceState.busy;

            await this.send(`set-${attributeName} ${value}`);

            // return result;
        } catch (err: unknown) {
            this.logDeviceError(this, err as Error)

            throw err;
        } finally {
            this.state = DeviceState.ready;
        }
    }

    private setAttributes(attributes: GenericDeviceAttribute[]) {
        for (const attr of attributes) {
            this.attributes.set(attr.name, attr);
        }
    }
}
