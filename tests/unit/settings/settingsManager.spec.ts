import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormatsPlugin from 'ajv-formats';
import SettingsManager from '../../../src/settings/settingsManager.js';
import PlainToClassSerializer from '../../../src/serialization/plainToClassSerializer.js';
import ClassToPlainSerializer from '../../../src/serialization/classToPlainSerializer.js';
import Logger from '../../../src/logging/Logger.js';
import DeviceSource from '../../../src/settings/deviceSource.js';
import SettingsEventType from '../../../src/settings/settingsEventType.js';

const createSerializers = (): { plainToClass: PlainToClassSerializer; classToPlain: ClassToPlainSerializer } => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    ajvFormatsPlugin.default(ajv);

    return {
        plainToClass: new PlainToClassSerializer(ajv, { excludeExtraneousValues: true }),
        classToPlain: new ClassToPlainSerializer(),
    };
};

const waitFor = async (assertion: () => void, timeout = 3000, interval = 50): Promise<void> => {
    const start = Date.now();

    for (;;) {
        try {
            assertion();
            return;
        } catch (err) {
            if (Date.now() - start > timeout) {
                throw err;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
};

describe('SettingsManager', () => {
    let tmpDir: string;
    let settingsFilePath: string;
    let mockLogger: ReturnType<typeof mock<Logger>>;
    let settingsManager: SettingsManager;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slvctrlplus-settingsmanager-test-'));
        settingsFilePath = path.join(tmpDir, 'settings.json');
        fs.writeFileSync(settingsFilePath, JSON.stringify({ knownDevices: {}, deviceSources: {} }));

        mockLogger = mock<Logger>();
        mockLogger.child.mockReturnValue(mockLogger);

        const { plainToClass, classToPlain } = createSerializers();

        settingsManager = new SettingsManager(
            settingsFilePath,
            plainToClass,
            classToPlain,
            new EventEmitter(),
            mockLogger,
        );
    });

    afterEach(async () => {
        await settingsManager.stopWatching();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('does not treat its own save() write as an external change', async () => {
        const settings = settingsManager.load();
        settingsManager.startWatching();

        const changedListener = vi.fn();
        settingsManager.on(SettingsEventType.changed, changedListener);

        settings.addDeviceSource(new DeviceSource('source-1', 'virtual', {}));

        // Own write should fire exactly once, from save() itself, never from the watcher
        await new Promise(resolve => setTimeout(resolve, 500));

        expect(changedListener).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('reloaded after external change'));
    });

    it('reloads settings and emits an event when the file is changed externally', async () => {
        settingsManager.load();
        settingsManager.startWatching();
        await new Promise(resolve => setTimeout(resolve, 300)); // let chokidar finish its async setup

        const changedListener = vi.fn();
        settingsManager.on(SettingsEventType.changed, changedListener);

        const externalSourceId = 'b6a0f45e-c3d0-4dca-ab81-7daac0764292';
        const externalContent = JSON.stringify({
            knownDevices: {},
            deviceSources: {
                [externalSourceId]: { id: externalSourceId, type: 'virtual', config: {} },
            },
        });

        fs.writeFileSync(settingsFilePath, externalContent);

        await waitFor(() => expect(changedListener).toHaveBeenCalledTimes(1));

        const reloaded = settingsManager.getSettings();
        expect(reloaded?.getDeviceSources().has(externalSourceId)).toBe(true);
    });

    it('ignores an externally written file with invalid JSON and keeps previous settings', async () => {
        settingsManager.load();
        settingsManager.startWatching();
        await new Promise(resolve => setTimeout(resolve, 300)); // let chokidar finish its async setup

        const changedListener = vi.fn();
        settingsManager.on(SettingsEventType.changed, changedListener);

        fs.writeFileSync(settingsFilePath, '{ not valid json');

        await waitFor(() => expect(mockLogger.error).toHaveBeenCalled());

        expect(changedListener).not.toHaveBeenCalled();
        expect(settingsManager.getSettings()?.getDeviceSources().size).toBe(0);
    });

    it('ignores an externally written file that fails schema validation and keeps previous settings', async () => {
        settingsManager.load();
        settingsManager.startWatching();
        await new Promise(resolve => setTimeout(resolve, 300)); // let chokidar finish its async setup

        const changedListener = vi.fn();
        settingsManager.on(SettingsEventType.changed, changedListener);

        fs.writeFileSync(settingsFilePath, JSON.stringify({ unexpectedField: true }));

        await waitFor(() => expect(mockLogger.error).toHaveBeenCalled());

        expect(changedListener).not.toHaveBeenCalled();
    });

    it('startWatching() is idempotent and stopWatching() can be called when not watching', async () => {
        settingsManager.load();

        expect(() => settingsManager.startWatching()).not.toThrow();
        expect(() => settingsManager.startWatching()).not.toThrow();

        await expect(settingsManager.stopWatching()).resolves.not.toThrow();
        await expect(settingsManager.stopWatching()).resolves.not.toThrow();
    });
});
