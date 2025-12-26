import DeviceAttribute, {DeviceAttributeModifier} from "../../attribute/deviceAttribute.js";
import BoolDeviceAttribute from "../../attribute/boolDeviceAttribute.js";
import FloatDeviceAttribute from "../../attribute/floatDeviceAttribute.js";
import StrDeviceAttribute from "../../attribute/strDeviceAttribute.js";
import IntRangeDeviceAttribute from "../../attribute/intRangeDeviceAttribute.js";
import ListDeviceAttribute from "../../attribute/listDeviceAttribute.js";
import IntDeviceAttribute from "../../attribute/intDeviceAttribute.js";
import {Int} from "../../../util/numbers.js";
import {SlvCtrlPlusDeviceAttributes} from "./slvCtrlPlusDevice.js";

type StatusResponse = { [key: string]: string };

export default class SlvCtrlPlusMessageParser
{
    private static readonly commandSeparator = ';';

    private static readonly attributeSeparator = ',';

    private static readonly attributeNameValueSeparator = ':';

    public static parseDeviceAttributes(response: string): SlvCtrlPlusDeviceAttributes {
        // attributes;connected:ro[bool],adc:rw[bool],mode:rw[118-140],levelA:rw[0-99],levelB:rw[0-99]
        const attributeList = {} as SlvCtrlPlusDeviceAttributes;

        const responseParts = response.split(SlvCtrlPlusMessageParser.commandSeparator);

        if ('attributes' !== responseParts.shift()) {
            throw new Error(`Invalid response format for parsing attributes: ${response}`);
        }

        const responseAttributes = responseParts.shift();

        if (undefined === responseAttributes) {
            return attributeList;
        }

        for (const attrDef of responseAttributes.split(SlvCtrlPlusMessageParser.attributeSeparator)) {
            const attrParts = attrDef.split(SlvCtrlPlusMessageParser.attributeNameValueSeparator);

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

    public static parseStatus(data: string): StatusResponse|null
    {
        const dataParts: string[] = data.split(SlvCtrlPlusMessageParser.commandSeparator);

        if ('status' !== dataParts.shift()) {
            return null;
        }

        const dataObj: StatusResponse = {};
        const attributeStatus = dataParts.shift();

        if (undefined === attributeStatus) {
            return dataObj;
        }

        for (const dataPart of attributeStatus.split(SlvCtrlPlusMessageParser.attributeSeparator)) {
            const [key, value]: string[] = dataPart.split(SlvCtrlPlusMessageParser.attributeNameValueSeparator);

            dataObj[key] = value;
        }

        return dataObj;
    }

    private static createAttributeFromValue(name: string, definition: string): DeviceAttribute|undefined {
        const re = /^(ro|rw|wo)\[(.+?)\]$/;
        const reRange = /^(\d+)-(\d+)$/;
        const reResult = re.exec(definition);

        if (null === reResult) {
            return undefined;
        }

        const type = reResult[1];
        const value = reResult[2];
        let result: RegExpExecArray|null;
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
                name, undefined, modifier, new Map(resultList.map(v => [v, v]))
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
