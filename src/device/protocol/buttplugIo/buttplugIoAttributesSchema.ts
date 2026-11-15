import { Type } from '@sinclair/typebox';
import type { TObject, TProperties } from '@sinclair/typebox';
import { rangeProperty, boolProperty, intProperty } from '../../attribute/attributeSchema.js';

export type ButtplugIoActuatorDescriptor = {
    key: string;
    label: string;
    kind: 'range';
    min: number;
    max: number;
} | {
    key: string;
    label: string;
    kind: 'bool';
};

export type ButtplugIoSensorDescriptor = {
    key: string;
    label: string;
    kind: 'rangeInt';
    min: number;
    max: number;
} | {
    key: string;
    label: string;
    kind: 'int';
};

export type ButtplugIoDescriptor = ButtplugIoActuatorDescriptor | ButtplugIoSensorDescriptor;

const buttplugIoAttributesSchema = (descriptors: ButtplugIoDescriptor[]): TObject => {
    const properties: TProperties = {};

    for (const desc of descriptors) {
        switch (desc.kind) {
            case 'range':
                properties[desc.key] = rangeProperty(intProperty({
                    label: desc.label,
                    writeOnly: true,
                    default: 0,
                }), {
                    min: desc.min,
                    max: desc.max,
                    incrementStep: 1,
                });
                break;
            case 'bool':
                properties[desc.key] = boolProperty({
                    label: desc.label,
                    writeOnly: true,
                    default: false,
                });
                break;
            case 'rangeInt':
                properties[desc.key] = rangeProperty(intProperty({
                    label: desc.label,
                    readOnly: true,
                    default: 0,
                }), {
                    min: desc.min,
                    max: desc.max,
                    incrementStep: 1,
                });
                break;
            case 'int':
                properties[desc.key] = intProperty({
                    label: desc.label,
                    readOnly: true,
                    default: 0,
                });
                break;
        }
    }

    return Type.Object(properties, { additionalProperties: false });
};

export default buttplugIoAttributesSchema;
