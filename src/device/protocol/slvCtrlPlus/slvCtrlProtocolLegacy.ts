import type DeviceAttribute from '../../attribute/deviceAttribute.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import type { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import type {
    KeyValuePairs, Result,
    SlvCtrlProtocolMessage,
} from './slvCtrlProtocol.js';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import type { DecodeResult, InferMessage, InferResponse } from '../deviceProtocol.js';
import { hasExactLength } from '../../../util/typeUtils.js';

export type StatusResponse = Record<string, string>;

export default class SlvCtrlProtocolLegacy extends SlvCtrlProtocol
{
    public override encode(command: InferMessage<SlvCtrlProtocolMessage>): Buffer {
        let commandToSend = command.command;
        let commandArgs;

        if (['get', 'set'].includes(command.command)) {
            commandToSend = `${command.command}-${command.args[0]}`;
            commandArgs = command.args.slice(1);
        } else {
            commandArgs = command.args;
        }

        const argsToSend = commandArgs.map(arg => (typeof arg === 'boolean' ? Number(arg) : arg).toString());

        const argsSuffixed = argsToSend.length > 0 ? ` ${argsToSend.join(' ')}` : '';
        return Buffer.from(`${commandToSend}${argsSuffixed}`, 'utf-8');
    }

    public override decode(rawData: Buffer): DecodeResult<InferResponse<SlvCtrlProtocolMessage>> {
        const [command, data, result] = rawData.toString('utf-8').split(SlvCtrlProtocol.segmentSeparator);

        if (undefined === command || undefined === data) {
            return { error: { type: 'invalid_frame', reason: 'Mandatory segment missing' } };
        }

        const keyValuePairs: KeyValuePairs = {};
        const unparsedKeyValuePairs = data.split(SlvCtrlProtocol.attributeSeparator);

        if (command.startsWith('set-') && hasExactLength(unparsedKeyValuePairs, 1)) {
            [keyValuePairs.value] = unparsedKeyValuePairs;
        } else if (command === 'introduce' && hasExactLength(unparsedKeyValuePairs, SlvCtrlProtocol.introductionSegmentCount)) {
            [keyValuePairs.type, keyValuePairs.fw, keyValuePairs.protocol] = unparsedKeyValuePairs;
        } else {
            for (const foo of unparsedKeyValuePairs) {
                const [key, value] = foo.split(SlvCtrlProtocol.keyValueSeparator);

                if (undefined !== key && '' !== key && undefined !== value) {
                    keyValuePairs[key] = value;
                }
            }
        }

        return {
            message: {
                command: command,
                data: keyValuePairs,
                result: undefined === result ? { status: 'ok' } : SlvCtrlProtocolLegacy.parseResult(result),
            },
        };
    }

    public override getAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceAttributes {
        return SlvCtrlProtocolLegacy.parseDeviceAttributes(responseData);
    }

    private static parseDeviceAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceAttributes {
        // attributes;connected:ro[bool],adc:rw[bool],mode:rw[118-140],levelA:rw[0-99],levelB:rw[0-99]
        const attributeList: SlvCtrlPlusDeviceAttributes = {};

        for (const [attrName, attrDef] of Object.entries(responseData)) {
            const attr = this.createAttributeFromValue(attrName, attrDef);

            if (undefined === attr) {
                continue;
            }

            attributeList[attrName] = attr;
        }

        return attributeList;
    }

    private static createAttributeFromValue(name: string, definition: string): DeviceAttribute | undefined {
        const re = /^(ro|rw|wo)\[(.+?)\]$/;
        const reRange = /^(\d+)-(\d+)$/;
        const reResult = re.exec(definition);

        if (null === reResult || !hasExactLength(reResult, SlvCtrlProtocolLegacy.attributeSegmentCount)) {
            return undefined;
        }

        const [, type, value] = reResult;
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
        } else if (null !== (result = reRange.exec(value)) && hasExactLength(result, SlvCtrlProtocol.rangeSegmentCount)) {
            const [, min, max] = result;

            attr = IntRangeDeviceAttribute.create(
                name,
                undefined,
                modifier,
                undefined,
                Int.from(parseInt(min, 10)),
                Int.from(parseInt(max, 10)),
                Int.from(1),
            );
        } else if ((resultList = value.split('|')).length > 0) {
            attr = ListDeviceAttribute.create<string, string>(
                name, undefined, modifier, resultList.map(v => ({ key: v, value: v })),
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

    private static parseResult(rawResult: string): Result
    {
        const [status, reason] = rawResult.split(',');

        const result: Result = { status: (status === 'ok' || status === 'error') ? status : 'unknown' };

        if (undefined !== reason) {
            result.reason = reason;
        }

        return result;
    }
}
