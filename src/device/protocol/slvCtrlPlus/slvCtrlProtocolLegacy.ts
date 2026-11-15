import { Type } from '@sinclair/typebox';
import type { TProperties, TSchema } from '@sinclair/typebox';
import type { DeviceAttributeValues } from '../../device.js';
import { rangeProperty, intProperty, floatProperty, boolProperty, strProperty } from '../../attribute/attributeSchema.js';
import type {
    KeyValuePairs, Result,
    SlvCtrlProtocolMessage,
    SlvCtrlPlusDeviceParseResult,
} from './slvCtrlProtocol.js';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import type { DecodeResult, InferMessage, InferResponse } from '../deviceProtocol.js';
import { hasExactLength } from '../../../util/typeUtils.js';

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

    public override getAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceParseResult {
        const properties: TProperties = {};
        const data: DeviceAttributeValues = {};

        // attributes;connected:ro[bool],adc:rw[bool],mode:rw[118-140],levelA:rw[0-99],levelB:rw[0-99]
        for (const [attrName, attrDef] of Object.entries(responseData)) {
            const parsed = SlvCtrlProtocolLegacy.parseAttributeDefinition(attrName, attrDef);

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
        const reRange = /^(\d+)-(\d+)$/;
        const reResult = re.exec(definition);

        if (null === reResult || !hasExactLength(reResult, SlvCtrlProtocolLegacy.attributeSegmentCount)) {
            return undefined;
        }

        const [, type, value] = reResult;
        const modifierKeywords = SlvCtrlProtocolLegacy.getModifierKeywords(type);

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

        if (null !== (result = reRange.exec(value)) && hasExactLength(result, SlvCtrlProtocol.rangeSegmentCount)) {
            const [, min, max] = result;

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

        // Legacy protocol: remaining patterns are pipe-separated string lists
        const resultList = value.split('|');

        if (resultList.length > 0) {
            return {
                property: strProperty({ label: name, ...modifierKeywords }),
                initialValue: undefined,
            };
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
