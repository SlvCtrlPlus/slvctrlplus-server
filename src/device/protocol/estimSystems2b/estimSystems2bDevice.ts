import {Exclude} from "class-transformer";
import Device from "../../device.js";
import DeviceTransport from "../../transport/deviceTransport.js";
import GenericDeviceAttribute from "../../attribute/genericDeviceAttribute.js";

type EstimSystems2BDeviceData = {
    batteryLevel: number,
    channelALevel: number,
    channelBLevel: number,
    pulseFrequency: number,
    pulsePwm: number,
    currentMode: number,
    powerMode: string,
    channelsJoined: boolean,
    firmwareVersion: string,
}

@Exclude()
export default class EstimSystems2BDevice extends Device
{
    protected readonly transport: DeviceTransport;

    protected currentData: EstimSystems2BDeviceData = null;

    protected constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        transport: DeviceTransport,
        controllable: boolean,
        attributes: GenericDeviceAttribute[]
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes);
        this.transport = transport;

        this.transport.receive((data: string): Promise<void> => {
            return new Promise<void>((resolve) => {
                this.currentData = EstimSystems2BDevice.parseResponse(data);

                resolve();
            });
        });
    }

    public refreshData(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public getAttribute(key: string): Promise<string | number | boolean> {
        return new Promise<string | number | boolean>(() => {
            return this.currentData[key];
        });
    }

    public async setAttribute(attributeName: string, value: string | number | boolean): Promise<string> {
        let command;

        switch (attributeName) {
            case 'currentMode':
                command = 'M' + value;
                break;
            case 'channelALevel':
                command = 'A' + value;
                break;
            case 'channelBLevel':
                command = 'B' + value;
                break;
            case 'pulseFrequency':
                command = 'C' + value;
                break;
            case 'pulsePwm':
                command = 'D' + value;
                break;
            case 'resetDevice':
                command = 'E';
                break;
            case 'resetPower':
                command = 'K';
                break;
            case 'channelsJoined':
                command = true === value ? 'J' : 'U';
                break;
            case 'powerMode':
                switch (value) {
                    case 'low': command = 'L'; break;
                    case 'high': command = 'H'; break;
                    default: throw new Error('Unknown power level: ' + value)
                }
                break;
            default:
                throw new Error('Unknown attribute ' + attributeName);
        }

        return await this.send(command);
    }

    protected getSerialTimeout(): number {
        return 0;
    }

    protected async send(command: string): Promise<string> {
        return await this.transport.sendAndAwaitReceive(command + "\r", this.getSerialTimeout());
    }

    protected static parseResponse(response: string): EstimSystems2BDeviceData {
        const parts = response.split(':');

        return {
            batteryLevel: Number(parts[0]),
            channelALevel: Number(parts[1])/2,
            channelBLevel: Number(parts[2])/2,
            pulseFrequency: Number(parts[3])/2,
            pulsePwm: Number(parts[4])/2,
            currentMode: Number(parts[5]),
            powerMode: parts[6],
            channelsJoined: Number(parts[7]) === 1,
            firmwareVersion: parts[8]
        };
    }
}
