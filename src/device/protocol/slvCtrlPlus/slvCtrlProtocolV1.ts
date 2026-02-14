import DeviceAttribute, { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import DeviceTransport from '../../transport/deviceTransport.js';
import SlvCtrlProtocol, { DeviceInfo } from './slvCtrlProtocol.js';

type KeyValuePairs = { [key: string]: string };
type Result = {
    status: 'ok' | 'error' | 'unknown',
    reason?: string,
} & {
    [key: string]: string,
}
type SlvCtrlProtocolResponse = {
    command: string,
    data: KeyValuePairs,
    result: Result,
}

export default class SlvCtrlProtocolV1 extends SlvCtrlProtocol
{
    private static readonly segmentSeparator = ';';

    private static readonly attributeSeparator = ',';

    private static readonly attributeNameValueSeparator = ':';

    public constructor(transport: DeviceTransport) {
        super(transport);
    }

    public getDeviceInfoFromIntroduction(introduction: string): DeviceInfo | undefined {
        const parsedResponse = SlvCtrlProtocolV1.parseResponse(introduction);

        if (undefined === parsedResponse || !('fw' in parsedResponse.data) || !('protocol' in parsedResponse.data) || !('type' in parsedResponse.data)) {
            return undefined;
        }

        return {
            deviceType: parsedResponse.data.type,
            fwVersion: parseInt(parsedResponse.data.fw, 10),
            protocolVersion: parseInt(parsedResponse.data.protocol, 10),
        };
    }

    public async getStatus(): Promise<KeyValuePairs> {
        const response = await this.send('status');

        const parsedResponse = SlvCtrlProtocolV1.parseResponse(response);

        if (undefined === parsedResponse || 'status' !== parsedResponse.command) {
            throw new Error(`Received unexpected response: ${response}`);
        }

        if (parsedResponse.result.status !== 'ok') {
            const reason = parsedResponse.result.reason ?? 'unknown';
            throw new Error(`Querying device status failed. Result: ${parsedResponse.result.status}, Reason: ${reason}`);
        }

        return parsedResponse.data;
    }

    public async getAttributes(): Promise<SlvCtrlPlusDeviceAttributes> {
        const response = await this.send('attributes');

        const parsedResponse = SlvCtrlProtocolV1.parseResponse(response);
        const attributeList = {} as SlvCtrlPlusDeviceAttributes;

        if (undefined === parsedResponse || 'attributes' !== parsedResponse.command) {
            throw new Error(`Invalid response format for parsing attributes: ${response}`);
        }

        if (parsedResponse.result.status !== 'ok') {
            const reason = parsedResponse.result.reason ?? 'unknown';
            throw new Error(`Querying device attributes failed. Result: ${parsedResponse.result.status}, Reason: ${reason}`);
        }

        for (const [attrName, attrDef] of Object.entries(parsedResponse.data)) {
            const attr = SlvCtrlProtocolV1.createAttributeFromValue(attrName, attrDef);

            if (undefined === attr) {
                continue;
            }

            attributeList[attr.name] = attr;
        }

        return attributeList;
    }

    public async setAttribute(attributeName: string, value: string): Promise<string | undefined> {
        const command = `set ${attributeName}`;
        const response = await this.send(`${command} ${value}`);
        const parsedResponse = SlvCtrlProtocolV1.parseResponse(response);

        if (undefined === parsedResponse) {
            throw new Error(`Received unexpected response: ${response}`);
        }

        if (parsedResponse.command !== command) {
            throw new Error(`Received response for unexpected command: ${parsedResponse.command}`);
        }

        if (parsedResponse.result.status !== 'ok') {
            const reason = parsedResponse.result.reason ?? 'unknown';
            throw new Error(`Device rejected '${command}'. Result: ${parsedResponse.result.status}, Reason: ${reason}`);
        }

        return ('value' in parsedResponse.data) ? parsedResponse.data.value : undefined;
    }

    private static createAttributeFromValue(name: string, definition: string): DeviceAttribute | undefined {
        const re = /^(ro|rw|wo)\[(.+?)\]$/;
        const reRange = /^(int|float)\((\d+)\.\.(\d+)\)$/;
        const reList = /^(int|str)\(([^|()]+(\|[^|()]+)*)\)$/;
        const reResult = re.exec(definition);

        if (null === reResult) {
            return undefined;
        }

        const type = reResult[1];
        const value = reResult[2];
        let result: RegExpExecArray | null;
        let resultList: string[];

        const modifier = this.getAttributeTypeFromStr(type);

        let attr;

        if ('bool' === value) {
            attr = BoolDeviceAttribute.create(name, undefined, modifier);
        } else if ('int' === value) {
            attr = IntDeviceAttribute.create(name, undefined, modifier, undefined);
        } else if ('float' === value) {
            attr = FloatDeviceAttribute.create(name, undefined, modifier, undefined);
        } else if ('str' === value) {
            attr = StrDeviceAttribute.create(name, undefined, modifier);
        } else if (null !== (result = reRange.exec(value))) {
            if ('int' === result[1]) {
                attr = IntRangeDeviceAttribute.create(
                    name,
                    undefined,
                    modifier,
                    undefined,
                    Int.from(parseInt(result[2], 10)),
                    Int.from(parseInt(result[3], 10)),
                    Int.from(1),
                );
            } else if ('float' === result[1]) {
                throw new Error(`Range attributes of type float are currently not supported`);
            }
        } else if (null !== (result = reList.exec(value))) {
            const [, listType, listContent] = result;
            resultList = listContent.split('|');
            if ('str' === listType) {
                attr = ListDeviceAttribute.create<string, string>(
                    name, undefined, modifier, resultList.map(v => ({ key: v, value: v }))
                );
            } else if ('int' === listType) {
                attr = ListDeviceAttribute.create<Int, Int>(
                    name, undefined, modifier, resultList.map(v => {
                        const vInt = Int.from(parseInt(v, 10));
                        return { key: vInt, value: vInt };
                    })
                );
            }
        }

        if (undefined === attr) {
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

    private static parseResponse(response: string): SlvCtrlProtocolResponse | undefined {
        const segments = response.split(SlvCtrlProtocolV1.segmentSeparator);

        if (segments.length !== 3) {
            return undefined;
        }

        const infoSegment = SlvCtrlProtocolV1.parseSegment(segments[1]);

        if (undefined === infoSegment) {
            return undefined;
        }

        const resultSegment = SlvCtrlProtocolV1.parseSegment(segments[2]);

        if (undefined === resultSegment || !this.isResultSegment(resultSegment)) {
            return undefined;
        }

        return {
            command: segments[0],
            data: infoSegment,
            result: resultSegment,
        }
    }

    private static parseSegment(segment: string): KeyValuePairs {
        const keyValuePairsRaw = segment.split(SlvCtrlProtocolV1.attributeSeparator);
        const keyValuePairs: KeyValuePairs = {};

        for (const keyValuePairRaw of keyValuePairsRaw) {
            const [key, value] = keyValuePairRaw.split(SlvCtrlProtocolV1.attributeNameValueSeparator);

            if (undefined === key || undefined === value) {
                continue;
            }

            keyValuePairs[key] = value;
        }

        return keyValuePairs;
    }

    private async send(command: string): Promise<string> {
        return await this.transport.sendAndAwaitReceive(command + '\n', SlvCtrlProtocol.transportTimeoutMs);
    }

    private static isResultSegment(keyValuePairs: KeyValuePairs): keyValuePairs is Result {
        return 'status' in keyValuePairs;
    }
}
