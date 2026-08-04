import fs from 'fs';
import { watch, FSWatcher } from 'chokidar';
import PlainToClassSerializer from '../serialization/plainToClassSerializer.js';
import ClassToPlainSerializer from '../serialization/classToPlainSerializer.js';
import Settings, { SettingsSchema } from './settings.js';
import onChange from 'on-change';
import DeviceSource from './deviceSource.js';
import SlvCtrlPlusSerialDeviceProvider from '../device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js';
import Logger from '../logging/Logger.js';
import EventEmitter from 'events';
import SettingsEventType from './settingsEventType.js';
import { JsonObject } from '../types.js';
import { logError } from '../util/error.js';

type SettingsEvents = {
    [SettingsEventType.changed]: (settings: Settings) => void;
};

export default class SettingsManager
{
    private readonly settingsFilePath: string;

    private settings?: Settings;

    private readonly plainToClassSerializer: PlainToClassSerializer;

    private readonly classToPlainSerializer: ClassToPlainSerializer;

    private readonly eventEmitter: EventEmitter;

    private readonly logger: Logger;

    private watcher?: FSWatcher;

    /** Content of the settings file as written by our own save(), used to tell apart external edits from our own writes */
    private lastWrittenContent?: string;

    public constructor(
        settingsFilePath: string,
        plainToClassSerializer: PlainToClassSerializer,
        classToPlainSerializer: ClassToPlainSerializer,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        this.settingsFilePath = settingsFilePath;
        this.plainToClassSerializer = plainToClassSerializer;
        this.classToPlainSerializer = classToPlainSerializer;
        this.eventEmitter = eventEmitter;
        this.logger = logger;
    }

    public load(): Settings {
        if (undefined !== this.settings) {
            return this.settings;
        }

        if (!fs.existsSync(this.settingsFilePath)) {
            this.settings = SettingsManager.getDefaultSettings();
            this.save();
        } else {
            const fileContent = fs.readFileSync(this.settingsFilePath, 'utf8');

            try {
                const plainJsonSettings: JsonObject = JSON.parse(fileContent);
                this.settings = this.transformPlainToSettings(plainJsonSettings);
            } catch (e: unknown) {
                logError(this.logger, 'Settings are not in a valid format', e);
                throw e;
            }

            this.lastWrittenContent = fileContent;
            this.logger.info(`Settings loaded from file: ${this.settingsFilePath}`);
        }

        this.settings = onChange(this.settings, () => this.save());

        return this.settings;
    }

    public replace(settings: Settings): void {
        this.settings = onChange(settings, () => this.save());
        this.save();
        this.logger.info(`Settings have been replaced with new value`);
    }

    /**
     * Starts watching the settings file on disk for changes made by another process (e.g. manual edits).
     * Own writes via save() are recognized and ignored so they don't trigger a redundant reload.
     */
    public startWatching(): void {
        if (undefined !== this.watcher) {
            return;
        }

        this.watcher = watch(this.settingsFilePath, {
            ignoreInitial: true,
            // Debounce editors/tools that write the file in multiple chunks (or via temp file + rename)
            awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
        });

        this.watcher.on('change', () => this.handleExternalChange());
        this.watcher.on('error', (err: unknown) => logError(
            this.logger,
            `Settings file watcher error for '${this.settingsFilePath}'`,
            err,
        ));

        this.logger.debug(`Watching '${this.settingsFilePath}' for external changes`);
    }

    public async stopWatching(): Promise<void> {
        if (undefined === this.watcher) {
            return;
        }

        await this.watcher.close();
        this.watcher = undefined;
    }

    public on<E extends keyof SettingsEvents>(event: E, listener: SettingsEvents[E]): this
    {
        this.eventEmitter.on(event, listener);
        return this;
    }

    public off<E extends keyof SettingsEvents>(event: E, listener: SettingsEvents[E]): this
    {
        this.eventEmitter.off(event, listener);
        return this;
    }

    public getSettings(): Settings | undefined {
        return this.settings;
    }

    private save(): void {
        if (undefined === this.settings) {
            return;
        }

        try {
            const normalized = this.classToPlainSerializer.transform(this.settings);
            const json = JSON.stringify(normalized, null, 4);

            fs.writeFileSync(this.settingsFilePath, json);
            // Remember what we just wrote so the file watcher can recognize and ignore this write
            this.lastWrittenContent = json;

            this.eventEmitter.emit('settingsChanged', this.settings);
            this.logger.debug(`Settings saved to '${this.settingsFilePath}' due to a change`);
        } catch (err: unknown) {
            logError(this.logger, `Could not save settings file to '${this.settingsFilePath}'`, err);
        }
    }

    /**
     * Invoked by the file watcher when the settings file changed on disk. Ignores changes that
     * originated from our own save() and reloads + emits an event for genuine external edits.
     */
    private handleExternalChange(): void {
        let content: string;

        try {
            content = fs.readFileSync(this.settingsFilePath, 'utf8');
        } catch (err: unknown) {
            logError(this.logger, `Could not read settings file '${this.settingsFilePath}' after change was detected`, err);
            return;
        }

        if (content === this.lastWrittenContent) {
            // This change was caused by our own save(), nothing to do
            return;
        }

        let plainJsonSettings: JsonObject;

        try {
            plainJsonSettings = JSON.parse(content);
        } catch (err: unknown) {
            logError(this.logger, `Ignoring external change to '${this.settingsFilePath}': content is not valid JSON`, err);
            return;
        }

        let parsedSettings: Settings;

        try {
            parsedSettings = this.transformPlainToSettings(plainJsonSettings);
        } catch (err: unknown) {
            logError(this.logger, `Ignoring external change to '${this.settingsFilePath}': settings are not in a valid format`, err);
            return;
        }

        this.lastWrittenContent = content;
        this.settings = onChange(parsedSettings, () => this.save());
        this.eventEmitter.emit('settingsChanged', this.settings);
        this.logger.info(`Settings reloaded after external change to '${this.settingsFilePath}'`);
    }

    private transformPlainToSettings(plainJsonSettings: JsonObject): Settings {
        return this.plainToClassSerializer.transform(Settings, plainJsonSettings, SettingsSchema);
    }

    private static getDefaultSettings(): Settings {
        const settings = new Settings();

        settings.addDeviceSource(new DeviceSource(
            'b6a0f45e-c3d0-4dca-ab81-7daac0764291',
            SlvCtrlPlusSerialDeviceProvider.providerName,
            {},
        ));

        return settings;
    }
}
