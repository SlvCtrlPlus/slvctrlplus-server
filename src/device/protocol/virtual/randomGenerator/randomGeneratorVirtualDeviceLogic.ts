import VirtualDeviceLogic from '../virtualDeviceLogic.js';
import type { VirtualDeviceSetup } from '../virtualDeviceLogic.js';
import type VirtualDevice from '../virtualDevice.js';
import type { RandomGeneratorVirtualDeviceConfig } from './randomGeneratorVirtualDeviceConfig.js';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { intProperty } from '../../../attribute/attributeSchema.js';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const randomGeneratorAttributesSchema = () => Type.Object({
    value: intProperty({ label: 'Random number', readOnly: true }),
}, { additionalProperties: false });

type RandomGeneratorDeviceData = Static<ReturnType<typeof randomGeneratorAttributesSchema>>;

export default class RandomGeneratorVirtualDeviceLogic extends VirtualDeviceLogic<
    RandomGeneratorDeviceData,
    RandomGeneratorVirtualDeviceConfig
> {
    private static readonly REFRESH_INTERVAL_MS = 100;

    public constructor(config: RandomGeneratorVirtualDeviceConfig) {
        super(config);

        if (config.min >= config.max) {
            throw new Error(
                `Invalid random generator config: min (${config.min}) must be less than max (${config.max})`,
            );
        }
    }

    public override get refreshInterval(): number {
        return RandomGeneratorVirtualDeviceLogic.REFRESH_INTERVAL_MS;
    }

    public async refreshData(device: VirtualDevice<RandomGeneratorVirtualDeviceLogic>): Promise<void> {
        const currentNumber = device.getDeviceData().value;
        let newNumber: number;

        do {
            newNumber = Math.floor(Math.random() * (this.config.max - this.config.min + 1)) + this.config.min;
        } while (newNumber === currentNumber);

        await device.updateDeviceData({ value: newNumber });
    }

    public override configureDevice(): VirtualDeviceSetup<RandomGeneratorDeviceData> {
        return {
            schema: randomGeneratorAttributesSchema(),
            data: {
                value: 0,
            },
        };
    }
}
