import GenericDeviceAttribute, {GenericDeviceAttributeModifier} from "../../attribute/genericDeviceAttribute.js";
import BoolGenericDeviceAttribute from "../../attribute/boolGenericDeviceAttribute.js";
import FloatGenericDeviceAttribute from "../../attribute/floatGenericDeviceAttribute.js";
import StrGenericDeviceAttribute from "../../attribute/strGenericDeviceAttribute.js";
import RangeGenericDeviceAttribute from "../../attribute/rangeGenericDeviceAttribute.js";
import ListGenericDeviceAttribute from "../../attribute/listGenericDeviceAttribute.js";
import IntGenericDeviceAttribute from "../../attribute/intGenericDeviceAttribute.js";

type StatusResponse = { [key: string]: string };

export default class SlvCtrlPlusMessageParser
{
    private static readonly commandSeparator = ';';

    private static readonly attributeSeparator = ',';

    private static readonly attributeNameValueSeparator = ':';

    public static parseDeviceAttributes(response: string): GenericDeviceAttribute[] {
        // attributes;connected:ro[bool],adc:rw[bool],mode:rw[118-140],levelA:rw[0-99],levelB:rw[0-99]
        const attributeList: GenericDeviceAttribute[] = [];

        const responseParts = response.split(SlvCtrlPlusMessageParser.commandSeparator);

        if ('attributes' !== responseParts.shift()) {
            throw new Error(`Invalid response format for parsing attributes: ${response}`);
        }

        const responseAttributes = responseParts.shift();

        if (!responseAttributes) {
            return attributeList;
        }

        for (const attr of responseAttributes.split(SlvCtrlPlusMessageParser.attributeSeparator)) {
            const attrParts = attr.split(SlvCtrlPlusMessageParser.attributeNameValueSeparator);

            if (!attrParts || 2 !== attrParts.length) {
                continue;
            }

            attributeList.push(this.createAttributeFromValue(attrParts[0], attrParts[1]));
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

        if (!attributeStatus) {
            return dataObj;
        }

        for (const dataPart of attributeStatus.split(SlvCtrlPlusMessageParser.attributeSeparator)) {
            const [key, value]: string[] = dataPart.split(SlvCtrlPlusMessageParser.attributeNameValueSeparator);

            dataObj[key] = value;
        }

        return dataObj;
    }

    private static createAttributeFromValue(name: string, definition: string): GenericDeviceAttribute {
        const re = /^(ro|rw|wo)\[(.+?)\]$/;
        const reRange = /^(\d+)-(\d+)$/;
        const reResult = re.exec(definition);
        const type = reResult[1];
        const value = reResult[2];
        let result: RegExpExecArray|null;
        let resultList: string[];

        const modifier = this.getAttributeTypeFromStr(type);

        let attr = null;

        if ('bool' === value) {
            attr = new BoolGenericDeviceAttribute();
        } else if ('int' === value) {
            attr = new IntGenericDeviceAttribute();
        } else if ('float' === value) {
            attr = new FloatGenericDeviceAttribute();
        } else if ('str' === value) {
            attr = new StrGenericDeviceAttribute();
        } else if (null !== (result = reRange.exec(value))) {
            attr = new RangeGenericDeviceAttribute();
            attr.min = Number(result[1]);
            attr.max = Number(result[2]);
        } else if ((resultList = value.split('|')).length > 0) {
            attr = new ListGenericDeviceAttribute();
            attr.values = resultList;
        } else {
            throw new Error(`Unknown attribute data type: ${value}`);
        }

        attr.name = name;
        attr.modifier = modifier;

        return attr;
    }

    private static getAttributeTypeFromStr(type: string): GenericDeviceAttributeModifier {
        if ('ro' === type) {
            return GenericDeviceAttributeModifier.readOnly;
        } else if ('rw' === type) {
            return GenericDeviceAttributeModifier.readWrite;
        } else if ('wo' === type) {
            return GenericDeviceAttributeModifier.writeOnly;
        }

        throw new Error(`Unknown attribute type: ${type}`);
    }
}
