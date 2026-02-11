import DeviceAttribute, { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import { DeviceInfo, SetAttributeResponse, SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import DeviceTransport from '../../transport/deviceTransport.js';

export type StatusResponse = { [key: string]: string };

export default class SlvCtrlProtocolLegacy extends SlvCtrlProtocol
{
    private static readonly commandSeparator = ';';

    private static readonly attributeSeparator = ',';

    private static readonly attributeNameValueSeparator = ':';

    public constructor(transport: DeviceTransport) {
        super(transport);
    }

    public getDeviceInfoFromIntroduction(introduction: string): DeviceInfo | undefined {
        const parts = introduction.split(';');

        if (parts.length !== 2 || 'introduce' !== parts[0]) {
            return undefined;
        }

        const deviceInfoParts = parts[1].split(',');

        if (deviceInfoParts.length !== 3) {
            return undefined;
        }

        const deviceType = deviceInfoParts[0];
        const fwVersion = parseInt(deviceInfoParts[1], 10);
        const protocolVersion = parseInt(deviceInfoParts[2], 10);

        if (isNaN(fwVersion) || isNaN(protocolVersion)) {
            return undefined;
        }

        return { deviceType, fwVersion, protocolVersion };
    }

    public async getStatus(): Promise<StatusResponse> {
        const response = await this.send('status');
        const parsedResult = SlvCtrlProtocolLegacy.parseStatus(response);

        if (undefined === parsedResult) {
            throw new Error(`Received unexpected response: ${response}`);
        }

        return parsedResult;
    }

    public async getAttributes(): Promise<SlvCtrlPlusDeviceAttributes> {
        const response = await this.send('attributes');

        return SlvCtrlProtocolLegacy.parseDeviceAttributes(response);
    }

    public async setAttribute(attributeName: string, value: string): Promise<void> {
        const command = `set-${attributeName}`;
        const response = await this.send(`${command} ${value}`);
        const parsedResult = SlvCtrlProtocolLegacy.parseAttributeSetResponse(response);

        if (undefined === parsedResult) {
            throw new Error(`Received unexpected response: ${response}`);
        }

        if (parsedResult.command !== command) {
            throw new Error(`Received response for unexpected command: ${parsedResult.command}`);
        }

        if (parsedResult.status !== 'ok') {
            throw new Error(`Device rejected '${command}' with status '${parsedResult.status}'`);
        }
    }

    public static parseIntroduce(response: string): DeviceInfo | undefined {
        const parts = response.split(SlvCtrlProtocolLegacy.commandSeparator);
        const deviceInfoParts = parts[1].split(',');

        if (deviceInfoParts.length !== 3) {
            return undefined;
        }

        const deviceType = deviceInfoParts[0];
        const fwVersion = parseInt(deviceInfoParts[1], 10);
        const protocolVersion = parseInt(deviceInfoParts[2], 10);

        if (isNaN(fwVersion) || isNaN(protocolVersion)) {
            return undefined;
        }

        return { deviceType, fwVersion, protocolVersion };
    }

    public static parseDeviceAttributes(response: string): SlvCtrlPlusDeviceAttributes {
        // attributes;connected:ro[bool],adc:rw[bool],mode:rw[118-140],levelA:rw[0-99],levelB:rw[0-99]
        const attributeList = {} as SlvCtrlPlusDeviceAttributes;

        const responseParts = response.split(SlvCtrlProtocolLegacy.commandSeparator);

        if ('attributes' !== responseParts.shift()) {
            throw new Error(`Invalid response format for parsing attributes: ${response}`);
        }

        const responseAttributes = responseParts.shift();

        if (undefined === responseAttributes) {
            return attributeList;
        }

        for (const attrDef of responseAttributes.split(SlvCtrlProtocolLegacy.attributeSeparator)) {
            const attrParts = attrDef.split(SlvCtrlProtocolLegacy.attributeNameValueSeparator);

            if (undefined === attrParts || 2 !== attrParts.length) {
                continue;
            }

            const attr = this.createAttributeFromValue(attrParts[0], attrParts[1]);

            if (undefined === attr) {
                continue;
            }

            attributeList[attr.name] = attr;
        }

        return attributeList;
    }

    public static parseStatus(data: string): StatusResponse | undefined {
        const [command, attributesData] = data.split(SlvCtrlProtocolLegacy.commandSeparator);

        if ('status' !== command || undefined === attributesData) {
            return undefined;
        }

        const dataObj: StatusResponse = {};

        const dataParts = attributesData
            .split(SlvCtrlProtocolLegacy.attributeSeparator)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const dataPart of dataParts) {
            const [key, value] = dataPart.split(SlvCtrlProtocolLegacy.attributeNameValueSeparator);

            dataObj[key] = value;
        }

        return dataObj;
    }

    public static parseAttributeSetResponse(response: string): SetAttributeResponse | undefined {
        const responseParts = response.split(';');

        if (responseParts.length !== 3) {
            return undefined;
        }

        const [command, value, statusTemp] = responseParts;
        const statusParts = statusTemp.split(':');

        if (statusParts.length !== 2) {
            return undefined;
        }

        return {
            command,
            value,
            status: statusParts[1],
        };
    }

    private static createAttributeFromValue(name: string, definition: string): DeviceAttribute | undefined {
        const re = /^(ro|rw|wo)\[(.+?)\]$/;
        const reRange = /^(\d+)-(\d+)$/;
        const reResult = re.exec(definition);

        if (null === reResult) {
            return undefined;
        }

        const type = reResult[1];
        const value = reResult[2];
        let result: RegExpExecArray | null;
        let resultList: string[];

        const modifier = this.getAttributeTypeFromStr(type);

        let attr = null;

        if ('bool' === value) {
            attr = BoolDeviceAttribute.create(name, undefined, modifier);
        } else if ('int' === value) {
            attr = IntDeviceAttribute.create(name, undefined, modifier, undefined);
        } else if ('float' === value) {
            attr = FloatDeviceAttribute.create(name, undefined, modifier, undefined);
        } else if ('str' === value) {
            attr = StrDeviceAttribute.create(name, undefined, modifier);
        } else if (null !== (result = reRange.exec(value))) {
            attr = IntRangeDeviceAttribute.create(
                name,
                undefined,
                modifier,
                undefined,
                Int.from(parseInt(result[1], 10)),
                Int.from(parseInt(result[2], 10)),
                Int.from(1),
            );
        } else if ((resultList = value.split('|')).length > 0) {
            attr = ListDeviceAttribute.create<string, string>(
                name, undefined, modifier, resultList.map(v => ({ key: v, value: v }))
            );
        } else {
            throw new Error(`Unknown attribute data type: ${value}`);
        }

        return attr;
    }

    private static getAttributeTypeFromStr(type: string): DeviceAttributeModifier {
        if ('ro' === type) {
            return DeviceAttributeModifier.readOnly;
        } else if ('rw' === type) {
            return DeviceAttributeModifier.readWrite;
        } else if ('wo' === type) {
            return DeviceAttributeModifier.writeOnly;
        }

        throw new Error(`Unknown attribute type: ${type}`);
    }

    private async send(command: string): Promise<string> {
        return await this.transport.sendAndAwaitReceive(command + '\n', SlvCtrlProtocol.transportTimeoutMs);
    }
}
