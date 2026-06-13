import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AppInstance } from '../../src/app.js';
import ScriptRuntime from '../../src/automation/scriptRuntime.js';
import AutomationEventType from '../../src/automation/automationEventType.js';
import {
    TEST_DEVICE_ID,
    createTestApp,
    teardownTestApp,
    resetTestApp,
    connectDevices,
} from './helpers/appHelper.js';
import ServiceMap from '../../src/serviceMap.js';
import { Container } from '@timesplinter/pimple';
import { appendFileSync } from 'fs';

const collectUntilMarker = (
    scriptRuntime: ScriptRuntime,
    marker: string,
    timeoutMs = 2000,
): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const collected: string[] = [];

        const listener = (msg: string) => {
            collected.push(msg);
            if (msg === marker) {
                scriptRuntime.off(AutomationEventType.consoleLog, listener);
                clearTimeout(timeout);
                resolve(collected);
            }
        };

        const timeout = setTimeout(() => {
            scriptRuntime.off(AutomationEventType.consoleLog, listener);
            reject(new Error(`Timed out waiting for marker "${marker}". Got: ${JSON.stringify(collected)}`));
        }, timeoutMs);

        scriptRuntime.on(AutomationEventType.consoleLog, listener);
    });
}

const waitForEvent = (scriptRuntime: ScriptRuntime, eventType: AutomationEventType): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        const listener = () => {
            clearTimeout(timeout);
            scriptRuntime.off(eventType, listener);
            resolve();
        };
        const timeout = setTimeout(() => {
            scriptRuntime.off(eventType, listener);
            reject(new Error(`Timed out waiting for ${eventType}`));
        }, 2000);
        scriptRuntime.on(eventType, listener);
    })
};

describe('Automation scripts', () => {
    let app: AppInstance;
    let tmpDir: string;
    let container: Container<ServiceMap>;

    beforeAll(async () => {
        ({ app, container, tmpDir } = await createTestApp());
    });

    afterAll(async () => {
        await teardownTestApp(app, container, tmpDir);
    });

    beforeEach(async () => {
        await resetTestApp(app, container);
    }, 2000);

    describe('Script lifecycle via REST API', () => {
        it('POST /automation/run loads the script and reports running status', async () => {
            const scriptRuntime = container.get('automation.scriptRuntime');

            const scriptStarted = waitForEvent(scriptRuntime, AutomationEventType.scriptStarted);

            const res = await request(app.instance)
                .post('/automation/run')
                .set('Content-Type', 'text/plain')
                .send('onEvent(() => {});');

            expect(res.status).toBe(200);
            expect(res.body.running).toBe(true);
            expect(res.body.runningSince).toBeDefined();

            await scriptStarted;

            const statusRes = await request(app.instance).get('/automation/status');
            expect(statusRes.status).toBe(200);
            expect(statusRes.body.running).toBe(true);
        });

        it('POST /automation/run returns 400 for non-text/plain content type', async () => {
            const scriptRuntime = container.get('automation.scriptRuntime');

            const res = await request(app.instance)
                .post('/automation/run')
                .set('Content-Type', 'application/json')
                .send(JSON.stringify({ script: 'onEvent(() => {});' }));

            expect(res.status).toBe(400);

            await scriptRuntime.stop();
        });

        it('GET /automation/stop stops the running script and emits scriptStopped', async () => {
            const scriptRuntime = container.get('automation.scriptRuntime');

            await request(app.instance)
                .post('/automation/run')
                .set('Content-Type', 'text/plain')
                .send('onEvent(() => {});');

            const scriptStopped = waitForEvent(scriptRuntime, AutomationEventType.scriptStopped);

            const stopRes = await request(app.instance).get('/automation/stop');
            expect(stopRes.status).toBe(200);

            await scriptStopped;

            const statusRes = await request(app.instance).get('/automation/status');
            expect(statusRes.status).toBe(200);
            expect(statusRes.body.running).toBe(false);
        });

        it('GET /automation/status returns not running when no script is loaded', async () => {
            const res = await request(app.instance).get('/automation/status');

            expect(res.status).toBe(200);
            expect(res.body.running).toBe(false);
            expect(res.body.runningSince).toBeNull();
        });
    });

    describe('Script reacts to device events', () => {
        it('onEvent is called with deviceConnected when a real device connects', async () => {
            const scriptRuntime = container.get('automation.scriptRuntime');
            const MARKER = 'connect-done';

            const logsPromise = collectUntilMarker(scriptRuntime, MARKER);

            await scriptRuntime.load(`
                onEvent(async (event) => {
                    if (event.type !== 'deviceConnected') return;
                    console.log(event.device.getDeviceId);
                    console.log(event.device.getDeviceName);
                    console.log('${MARKER}');
                });
            `);

            await connectDevices(container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

            const logs = await logsPromise;

            await scriptRuntime.stop();

            expect(logs).toContain(TEST_DEVICE_ID);
            expect(logs).toContain('Test Random Generator');
        });

        it('onEvent receives the real attribute value on deviceRefreshed', async () => {
            const scriptRuntime = container.get('automation.scriptRuntime');
            const MARKER = 'refresh-done';

            await connectDevices(container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

            await scriptRuntime.load(`
                onEvent(async (event) => {
                    if (event.type !== 'deviceRefreshed') return;
                    const attr = await event.device.getAttribute('value');
                    console.log(attr !== undefined ? String(attr.value) : 'no-value');
                    console.log('${MARKER}');
                });
            `);

            // collectUntilMarker is called after load() so its timeout only counts
            // event-wait time, not isolate-creation/compilation time.
            const logs = await collectUntilMarker(scriptRuntime, MARKER, 3000);

            await scriptRuntime.stop();

            const valueLog = logs.find(l => l !== MARKER)!;
            expect(valueLog).not.toBe('no-value');
            expect(Number(valueLog)).toBeGreaterThanOrEqual(0);
            expect(Number(valueLog)).toBeLessThanOrEqual(100);
        });

        it('onEvent is called with deviceDisconnected when a real device disconnects', async () => {
            const scriptRuntime = container.get('automation.scriptRuntime');
            const MARKER = 'disconnect-done';

            await connectDevices(container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

            const logsPromise = collectUntilMarker(scriptRuntime, MARKER);

            await scriptRuntime.load(`
                onEvent(async (event) => {
                    if (event.type !== 'deviceDisconnected') return;
                    console.log(event.device.getDeviceId);
                    console.log('${MARKER}');
                });
            `);

            const device = container.get('device.manager').getConnectedDevices()[0];
            await device.close();

            const logs = await logsPromise;
            expect(logs).toContain(TEST_DEVICE_ID);
        });

        it('onStart runs once when script is loaded via API, before any device events', async () => {
            const scriptRuntime = container.get('automation.scriptRuntime');
            const MARKER = 'start-done';

            const logsPromise = collectUntilMarker(scriptRuntime, MARKER);

            await request(app.instance)
                .post('/automation/run')
                .set('Content-Type', 'text/plain')
                .send(`
                    onStart(async () => {
                        console.log('init');
                        console.log('${MARKER}');
                    });
                    onEvent(() => {});
                `);

            const logs = await logsPromise;
            expect(logs).toContain('init');
            expect(logs.indexOf('init')).toBeLessThan(logs.indexOf(MARKER));
        });
    });
});
