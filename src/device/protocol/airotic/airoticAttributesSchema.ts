import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { strProperty, boolProperty, floatProperty } from '../../attribute/attributeSchema.js';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
const airoticAttributesSchema = () => Type.Object({
    restColor: strProperty({ label: 'Rest Color' }),
    breathInColor: strProperty({ label: 'Breath In Color' }),
    resetColors: boolProperty({ label: 'Reset Colors', writeOnly: true }),
    reboot: boolProperty({ label: 'Reboot bottle', writeOnly: true }),
    breathsPerMin: Type.Optional(floatProperty({ label: 'Breaths/min', readOnly: true, uom: 'breaths/min' })),
    bpmTrend: Type.Optional(strProperty({ label: 'BPM Trend', readOnly: true })),
}, { additionalProperties: false });

export type AiroticAttributeValues = Static<ReturnType<typeof airoticAttributesSchema>>;

export default airoticAttributesSchema;
