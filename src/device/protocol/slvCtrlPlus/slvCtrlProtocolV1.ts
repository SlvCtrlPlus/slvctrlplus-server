import { Type } from '@sinclair/typebox';
import type { TProperties, TSchema } from '@sinclair/typebox';
import type { DeviceAttributeValues } from '../../device.js';
import { rangeProperty, listProperty, intProperty, floatProperty, boolProperty, strProperty } from '../../attribute/attributeSchema.js';
import type {
    KeyValuePairs, Result,
    SlvCtrlProtocolMessage,
    SlvCtrlPlusDeviceParseResult,
} from './slvCtrlProtocol.js';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import type { DecodeResult, InferMessage, InferResponse } from '../deviceProtocol.js';
import { hasExactLength } from '../../../util/typeUtils.js';

export default class SlvCtrlProtocolV1 extends SlvCtrlProtocol
{
    private static readonly responseSegmentCount = 3;

    public override encode(command: InferMessage<SlvCtrlProtocolMessage>): Buffer {
        const argsToSend = command.args.map(arg => (typeof arg === 'boolean' ? Number(arg) : arg).toString());

        const argsSuffixed = argsToSend.length > 0 ? ` ${argsToSend.join(' ')}` : '';
        return Buffer.from(`${command.command}${argsSuffixed}`, 'utf-8');
    }

    public override decode(data: Buffer): DecodeResult<InferResponse<SlvCtrlProtocolMessage>> {
        return SlvCtrlProtocolV1.parseResponse(data.toString('utf-8'));
    }

    public override getAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceParseResult {
        const properties: TProperties = {};
        const data: DeviceAttributeValues = {};

        for (const [attrName, attrDef] of Object.entries(responseData)) {
            const parsed = SlvCtrlProtocolV1.parseAttributeDefinition(attrName, attrDef);

            if (undefined === parsed) {
                continue;
            }

            properties[attrName] = parsed.property;
            data[attrName] = parsed.initialValue;
        }

        return { schema: Type.Object(properties), data };
    }

    private static parseAttributeDefinition(name: string, definition: string): { property: TSchema, initialValue: unknown } | undefined {
        const re = /^(ro|rw|wo)\[(.+?)\]$/;
        const reRange = /^(int|float)\((\d+)\.\.(\d+)\)$/;
        const reList = /^(int|str)\(([^|()]+(\|[^|()]+)*)\)$/;
        const reResult = re.exec(definition);

        if (null === reResult || !hasExactLength(reResult, SlvCtrlProtocol.attributeSegmentCount)) {
            return undefined;
        }

        const [, modifierStr, value] = reResult;
        const modifierKeywords = SlvCtrlProtocolV1.getModifierKeywords(modifierStr);

        let result: RegExpExecArray | null;

        if ('bool' === value) {
            return { property: boolProperty({ label: name, ...modifierKeywords }), initialValue: undefined };
        }

        if ('int' === value) {
            return { property: intProperty({ label: name, ...modifierKeywords }), initialValue: undefined };
        }

        if ('float' === value) {
            return { property: floatProperty({ label: name, ...modifierKeywords }), initialValue: undefined };
        }

        if ('str' === value) {
            return { property: strProperty({ label: name, ...modifierKeywords }), initialValue: undefined };
        }

        if (null !== (result = reRange.exec(value))) {
            const [, type, min, max] = result;

            if ('int' === type) {
                if (undefined === min || undefined === max) {
                    throw new Error(`Malformed range attribute definition: ${value}`);
                }

                return {
                    property: rangeProperty(intProperty({
                        label: name,
                        ...modifierKeywords,
                    }), {
                        min: parseInt(min, 10),
                        max: parseInt(max, 10),
                        incrementStep: 1,
                    }),
                    initialValue: undefined,
                };
            }

            if ('float' === type) {
                throw new Error(`Range attributes of type float are currently not supported`);
            }
        }

        if (null !== (result = reList.exec(value))) {
            const [, listType, listContent] = result;

            if (undefined === listType || undefined === listContent) {
                throw new Error(`Malformed list attribute definition: ${value}`);
            }

            const items = listContent.split('|');

            if ('str' === listType) {
                return {
                    property: strProperty({ label: name, ...modifierKeywords }),
                    initialValue: undefined,
                };
            }

            if ('int' === listType) {
                return {
                    property: listProperty(intProperty({
                        label: name,
                        ...modifierKeywords,
                    }), {
                        choices: items.map(v => ({ value: parseInt(v, 10), label: v })),
                    }),
                    initialValue: undefined,
                };
            }
        }

        throw new Error(`Unknown attribute data type: ${value}`);
    }

    private static getModifierKeywords(type: string): { readOnly?: true, writeOnly?: true } {
        if ('ro' === type) {
            return { readOnly: true };
        }

        if ('wo' === type) {
            return { writeOnly: true };
        }

        if ('rw' === type) {
            return {};
        }

        throw new Error(`Unknown attribute type: ${type}`);
    }

    private static parseResponse(response: string): DecodeResult<InferResponse<SlvCtrlProtocolMessage>> {
        const segments = response.split(SlvCtrlProtocol.segmentSeparator);

        if (!hasExactLength(segments, SlvCtrlProtocolV1.responseSegmentCount)) {
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
            },
        };
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
