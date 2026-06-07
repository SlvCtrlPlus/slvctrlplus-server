import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AppInstance } from '../../src/app.js';
import { TEST_DEVICE_ID, createTestApp, teardownTestApp, resetTestApp, connectDevices } from './helpers/appHelper.js';

describe('REST API', () => {
    let instance: AppInstance;
    let tmpDir: string;

    beforeAll(async () => {
        ({ instance, tmpDir } = await createTestApp());
    });

    afterAll(async () => {
        await teardownTestApp(instance, tmpDir);
    });

    beforeEach(async () => {
        await resetTestApp(instance);
    });

    it('GET /devices returns connected devices', async () => {
        const testDeviceName = 'Test Random Generator';

        await connectDevices(instance, [{ id: TEST_DEVICE_ID, name: testDeviceName }]);

        const res = await request(instance.expressApp).get('/devices');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.items[0]).toEqual(expect.objectContaining({
            deviceId: TEST_DEVICE_ID,
            deviceName: testDeviceName,
            provider: 'virtual',
            deviceModel: 'randomGenerator',
            fwVersion: '1.0.0',
            state: 'READY',
            type: 'virtual',
            controllable: false,
            config: { min: 0, max: 100 },
            attributes: {
                value: expect.objectContaining({
                    name: 'value',
                    label: 'Random number',
                    modifier: 'ro',
                    type: 'int',
                }),
            },
        }));
    });
});
