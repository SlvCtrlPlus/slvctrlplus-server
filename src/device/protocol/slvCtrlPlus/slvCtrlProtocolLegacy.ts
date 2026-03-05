import DeviceAttribute, { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import FloatDeviceAttribute from '../../attribute/floatDeviceAttribute.js';
import StrDeviceAttribute from '../../attribute/strDeviceAttribute.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import SlvCtrlProtocol, {
    KeyValuePairs, Result,
    SlvCtrlProtocolCommand,
    SlvCtrlProtocolResponse
} from './slvCtrlProtocol.js';
import { DecodeResult } from '../deviceProtocol.js';

type SetAttributeResponse = {
    command: string,
    value: string,
    status: string,
};

export type StatusResponse = { [key: string]: string };

export default class SlvCtrlProtocolLegacy extends SlvCtrlProtocol
{
    private static readonly commandSeparator = ';';

    private static readonly attributeSeparator = ',';

    private static readonly attributeNameValueSeparator = ':';

    public encode(command: SlvCtrlProtocolCommand): Buffer {
        let commandToSend = command.command;
        let commandArgs;

        if (['get', 'set'].includes(command.command)) {
            commandToSend = `${command.command}-${command.args[0]}`;
            commandArgs = command.args.slice(1);
        } else {
            commandArgs = command.args;
        }

        const argsToSend = commandArgs.map(arg => (typeof arg === 'boolean'? Number(arg) : arg).toString());

        return Buffer.from(`${commandToSend} ${argsToSend.join(' ')}`, 'utf-8');
    }

    public decode(rawData: Buffer): DecodeResult<SlvCtrlProtocolResponse> {
        const [command, data, result] = rawData.toString('utf-8').split(';');

        if (undefined === command || undefined === data) {
            return { error: { type: 'invalid_frame', reason: 'Mandatory segment missing' } };
        }

        const keyValuePairs: KeyValuePairs = {};
        const unparsedKeyValuePairs = data.split(',');

        if (command.startsWith('set-') && unparsedKeyValuePairs.length === 1) {
            keyValuePairs.value = unparsedKeyValuePairs[0];
        } else if (command === 'introduce' && unparsedKeyValuePairs.length === 3) {
            keyValuePairs.type = unparsedKeyValuePairs[0];
            keyValuePairs.fw = unparsedKeyValuePairs[1];
            keyValuePairs.protocol = unparsedKeyValuePairs[2];
        } else {
            for (const foo of unparsedKeyValuePairs) {
                const [key, value] = foo.split(':');

                if (undefined !== key && '' !== key) {
                    keyValuePairs[key] = value;
                }
            }
        }

        return {
            message: {
                command: command,
                data: keyValuePairs,
                result: undefined === result ? { status: 'ok' } : this.parseResult(result),
            }
        }
    }

    public getAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceAttributes {
        return SlvCtrlProtocolLegacy.parseDeviceAttributes(responseData)
    }

    private parseResult(rawResult: string): Result
    {
        const [status, reason] = rawResult.split(',');

        const result: Result = { status: (['ok', 'error'].includes(status) ? status : 'unknown') as Result['status'] };

        if (undefined !== reason) {
            result.reason = reason;
        }

        return result;
    }

    private static parseDeviceAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceAttributes {
        // attributes;connected:ro[bool],adc:rw[bool],mode:rw[118-140],levelA:rw[0-99],levelB:rw[0-99]
        const attributeList = {} as SlvCtrlPlusDeviceAttributes;

        for (const [attrName, attrDef] of Object.entries(responseData)) {
            const attr = this.createAttributeFromValue(attrName, attrDef);

            if (undefined === attr) {
                continue;
            }

            attributeList[attrName] = attr;
        }

        return attributeList;
    }

    private static parseStatus(data: string): StatusResponse | undefined {
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

    private static parseAttributeSetResponse(response: string): SetAttributeResponse | undefined {
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
}
