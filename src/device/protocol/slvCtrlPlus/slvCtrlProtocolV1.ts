import DeviceAttribute, { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import SlvCtrlProtocol, {
    KeyValuePairs, Result,
    SlvCtrlProtocolCommand,
    SlvCtrlProtocolResponse
} from './slvCtrlProtocol.js';
import { DecodeResult } from '../deviceProtocol.js';
import { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';

export default class SlvCtrlProtocolV1 extends SlvCtrlProtocol
{
    private static readonly segmentSeparator = ';';

    private static readonly attributeSeparator = ',';

    private static readonly keyValueSeparator = ':';

    public encode(command: SlvCtrlProtocolCommand): Buffer {
        const argsToSend = command.args.map(arg => (typeof arg === 'boolean'? Number(arg) : arg).toString());

        const argsSuffixed = argsToSend.length > 0 ? ` ${argsToSend.join(' ')}` : '';
        return Buffer.from(`${command.command}${argsSuffixed}`, 'utf-8');
    }

    public decode(data: Buffer): DecodeResult<SlvCtrlProtocolResponse> {
        return SlvCtrlProtocolV1.parseResponse(data.toString('utf-8'));
    }

    public getAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceAttributes {
        const attributeList: SlvCtrlPlusDeviceAttributes = {};

        for (const [attrName, attrDef] of Object.entries(responseData)) {
            const attr = SlvCtrlProtocolV1.createAttributeFromValue(attrName, attrDef);

            if (undefined === attr) {
                continue;
            }

            attributeList[attr.name] = attr;
        }

        return attributeList;
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

    private static parseResponse(response: string): DecodeResult<SlvCtrlProtocolResponse> {
        const segments = response.split(SlvCtrlProtocolV1.segmentSeparator);

        if (segments.length !== 3) {
            return { error: { type: 'invalid_frame', reason: `Unexpected segment count (${segments.length})` } };
        }

        const infoSegment = SlvCtrlProtocolV1.parseSegment(segments[1]);
        const resultSegment = SlvCtrlProtocolV1.parseSegment(segments[2]);

        if (!this.isResultSegment(resultSegment)) {
            return { error: { type: 'invalid_frame', reason: `Result segment is malformed` } };
        }

        return {
            message: {
                command: segments[0],
                data: infoSegment,
                result: resultSegment,
            }
        }
    }

    private static parseSegment(segment: string): KeyValuePairs {
        const keyValuePairsRaw = segment.split(SlvCtrlProtocolV1.attributeSeparator);
        const keyValuePairs: KeyValuePairs = {};

        for (const keyValuePairRaw of keyValuePairsRaw) {
            const [key, value] = keyValuePairRaw.split(SlvCtrlProtocolV1.keyValueSeparator);

            if (undefined === key || undefined === value) {
                continue;
            }

            keyValuePairs[key] = value;
        }

        return keyValuePairs;
    }

    private static isResultSegment(keyValuePairs: KeyValuePairs): keyValuePairs is Result {
        return 'status' in keyValuePairs;
    }
}
