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

    describe('GET /version', () => {
        it('returns version string', async () => {
            const res = await request(instance.expressApp).get('/version');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('version');
            expect(typeof res.body.version).toBe('string');
        });
    });

    describe('GET /health', () => {
        it('returns 200 with metrics or 204 when not yet collected', async () => {
            const res = await request(instance.expressApp).get('/health');

            expect(res.status).toBeOneOf([200, 204]);
        });
    });

    describe('GET /devices', () => {
        it('returns connected devices', async () => {
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

        it('returns empty list when no devices connected', async () => {
            const res = await request(instance.expressApp).get('/devices');

            expect(res.status).toBe(200);
            expect(res.body.count).toBe(0);
            expect(res.body.items).toEqual([]);
        });
    });

    describe('GET /device/:deviceId', () => {
        it('returns a single connected device', async () => {
            await connectDevices(instance, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

            const res = await request(instance.expressApp).get(`/device/${TEST_DEVICE_ID}`);

            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({
                deviceId: TEST_DEVICE_ID,
                deviceName: 'Test Random Generator',
            }));
        });

        it('returns 404 for unknown device', async () => {
            const res = await request(instance.expressApp).get('/device/unknown-id');

            expect(res.status).toBe(404);
        });
    });

    describe('PATCH /device/:deviceId', () => {
        it('returns 404 for unknown device', async () => {
            const res = await request(instance.expressApp)
                .patch('/device/unknown-id')
                .send({});

            expect(res.status).toBe(404);
        });

        it('returns 202 for connected device', async () => {
            await connectDevices(instance, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

            const res = await request(instance.expressApp)
                .patch(`/device/${TEST_DEVICE_ID}`)
                .send({});

            expect(res.status).toBe(202);
        });
    });

    describe('GET /settings', () => {
        it('returns current settings as JSON', async () => {
            const res = await request(instance.expressApp).get('/settings');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/application\/json/);
            expect(res.body).toHaveProperty('knownDevices');
            expect(res.body).toHaveProperty('deviceSources');
        });
    });

    describe('PUT /settings', () => {
        it('accepts valid settings and returns them', async () => {
            const getRes = await request(instance.expressApp).get('/settings');
            const currentSettings = getRes.body;

            const res = await request(instance.expressApp)
                .put('/settings')
                .send(currentSettings);

            expect(res.status).toBe(200);
            const body = JSON.parse(res.text);
            expect(body).toHaveProperty('knownDevices');
            expect(body).toHaveProperty('deviceSources');
        });

        it('returns 400 for invalid settings', async () => {
            const res = await request(instance.expressApp)
                .put('/settings')
                .send({ invalid: true });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('errors');
        });
    });

    describe('GET /automation/scripts', () => {
        it('returns empty list when no scripts exist', async () => {
            const res = await request(instance.expressApp).get('/automation/scripts');

            expect(res.status).toBe(200);
            expect(res.body.count).toBe(0);
            expect(res.body.items).toEqual([]);
        });

        it('lists saved scripts', async () => {
            await request(instance.expressApp)
                .post('/automation/scripts/test.js')
                .set('Content-Type', 'text/plain')
                .send('onEvent(() => {});');

            const res = await request(instance.expressApp).get('/automation/scripts');

            expect(res.status).toBe(200);
            expect(res.body.count).toBe(1);
            expect(res.body.items[0]).toEqual(expect.objectContaining({ fileName: 'test.js' }));
        });
    });

    describe('POST /automation/scripts/:fileName', () => {
        it('creates a script and returns its content', async () => {
            const script = 'onEvent(() => {});';

            const res = await request(instance.expressApp)
                .post('/automation/scripts/my-script.js')
                .set('Content-Type', 'text/plain')
                .send(script);

            expect(res.status).toBe(201);
            expect(res.text).toBe(script);
        });

        it('returns 400 for invalid filename', async () => {
            const res = await request(instance.expressApp)
                .post('/automation/scripts/INVALID_NAME.js')
                .set('Content-Type', 'text/plain')
                .send('onEvent(() => {});');

            expect(res.status).toBe(400);
        });

        it('returns 400 for wrong content type', async () => {
            const res = await request(instance.expressApp)
                .post('/automation/scripts/test.js')
                .set('Content-Type', 'application/json')
                .send(JSON.stringify({ script: 'onEvent(() => {});' }));

            expect(res.status).toBe(400);
        });
    });

    describe('GET /automation/scripts/:fileName', () => {
        it('returns script content as plain text', async () => {
            const script = 'onEvent(() => {});';

            await request(instance.expressApp)
                .post('/automation/scripts/read-test.js')
                .set('Content-Type', 'text/plain')
                .send(script);

            const res = await request(instance.expressApp).get('/automation/scripts/read-test.js');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/plain/);
            expect(res.text).toBe(script);
        });

        it('returns 404 for non-existent script', async () => {
            const res = await request(instance.expressApp).get('/automation/scripts/nonexistent.js');

            expect(res.status).toBe(404);
        });

        it('returns 400 for invalid filename', async () => {
            const res = await request(instance.expressApp).get('/automation/scripts/INVALID_NAME.js');

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /automation/scripts/:fileName', () => {
        it('deletes a script and returns 204', async () => {
            await request(instance.expressApp)
                .post('/automation/scripts/to-delete.js')
                .set('Content-Type', 'text/plain')
                .send('onEvent(() => {});');

            const res = await request(instance.expressApp).delete('/automation/scripts/to-delete.js');

            expect(res.status).toBe(204);

            const getRes = await request(instance.expressApp).get('/automation/scripts/to-delete.js');
            expect(getRes.status).toBe(404);
        });

        it('returns 400 for invalid filename', async () => {
            const res = await request(instance.expressApp).delete('/automation/scripts/INVALID_NAME.js');

            expect(res.status).toBe(400);
        });
    });

    describe('GET /automation/log', () => {
        it('returns log as plain text after a script has run', async () => {
            await request(instance.expressApp)
                .post('/automation/run')
                .set('Content-Type', 'text/plain')
                .send('onEvent(() => {});');

            const res = await request(instance.expressApp).get('/automation/log');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/plain/);
        });
    });

    describe('GET /automation/status', () => {
        it('returns not running when no script is loaded', async () => {
            const res = await request(instance.expressApp).get('/automation/status');

            expect(res.status).toBe(200);
            expect(res.body.running).toBe(false);
            expect(res.body.runningSince).toBeNull();
        });
    });
});
