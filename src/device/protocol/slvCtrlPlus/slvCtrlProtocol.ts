import { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import DeviceTransport from '../../transport/deviceTransport.js';
import { StatusResponse } from './slvCtrlProtocolLegacy.js';

export type DeviceInfo = {
    deviceType: string,
    fwVersion: number,
    protocolVersion: number,
};

export default abstract class SlvCtrlProtocol
{
    protected static readonly transportTimeoutMs = 175;

    protected readonly transport: DeviceTransport;

    protected constructor(transport: DeviceTransport) {
        this.transport = transport;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public static parseIntroduce(introduction: string): DeviceInfo | undefined {
        throw new Error('parseIntroduce() must be implemented by subclass');
    }

    public abstract getDeviceInfoFromIntroduction(introduction: string): DeviceInfo | undefined;
    public abstract getStatus(): Promise<StatusResponse>;
    public abstract getAttributes(): Promise<SlvCtrlPlusDeviceAttributes>;
    public abstract setAttribute(attrName: string, value: string): Promise<string | undefined>;
}
