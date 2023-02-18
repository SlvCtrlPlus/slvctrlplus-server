import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import {Exclude, Expose, Type} from "class-transformer";
import SerialDevice from "../serialDevice.js";
import {GenericDeviceAttributeList} from "../types.js";
import GenericDeviceAttribute from "./genericDeviceAttribute.js";
import GenericDeviceAttributeDiscriminator from "../../serialization/discriminator/genericDeviceAttributeDiscriminator.js";

@Exclude()
export default class GenericDevice extends SerialDevice
{

    private readonly serialTimeout = 250;

    @Expose()
    private deviceModel: string;

    @Expose()
    @Type(() => GenericDeviceAttribute, GenericDeviceAttributeDiscriminator.createClassTransformerTypeDiscriminator('type'))
    private attributes: GenericDeviceAttribute[];

    @Expose()
    private data: JsonObject = {};

    @Expose()
    private readonly fwVersion: string;

    public constructor(
        fwVersion: string,
        deviceId: string,
        deviceName: string,
        deviceModel: string,
        connectedSince: Date,
        syncPort: SynchronousSerialPort,
        portInfo: PortInfo,
        attributes: GenericDeviceAttribute[]
    ) {
        super(deviceId, deviceName, connectedSince, syncPort, portInfo, false);

        this.deviceModel = deviceModel;
        this.fwVersion = fwVersion;
        this.attributes = attributes;
    }

    public refreshData(): void {
        this.send('status').then(data => {
            const dataObj = this.parseDataStr(data);

            if (null === dataObj) {
                return;
            }

            for (const attrKey in dataObj) {
                if (!dataObj.hasOwnProperty(attrKey)) {
                    continue;
                }
                this.data[attrKey] = ('' !== dataObj[attrKey]) ? dataObj[attrKey] : null;
            }

            this.updateLastRefresh();
        }).catch((e: Error) => this.logDeviceError(this, e));
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

    public getAttribute(key: string): any
    {
        return this.data[key];
    }
}
