import VirtualDeviceLogic from '../virtualDeviceLogic.js';
import type { VirtualDeviceSetup } from '../virtualDeviceLogic.js';
import type { NoDeviceConfig } from '../../../deviceConfig.js';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { strProperty } from '../../../attribute/attributeSchema.js';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const displayAttributesSchema = () => Type.Object({
    content: strProperty({ label: 'Content' }),
}, { additionalProperties: false });

type DisplayDeviceData = Static<ReturnType<typeof displayAttributesSchema>>;

export default class DisplayVirtualDeviceLogic extends VirtualDeviceLogic<DisplayDeviceData> {
    private static readonly REFRESH_INTERVAL_MS = 175;

    public constructor(config: NoDeviceConfig) {
        super(config);
    }

    public override async refreshData(): Promise<void> {
        // no-op, because it doesn't read anything from anywhere
        return Promise.resolve();
    }

    public override get refreshInterval(): number {
        return DisplayVirtualDeviceLogic.REFRESH_INTERVAL_MS;
    }

    public override configureDevice(): VirtualDeviceSetup<DisplayDeviceData> {
        return {
            schema: displayAttributesSchema(),
            data: {
                content: '',
            },
        };
    }
}
