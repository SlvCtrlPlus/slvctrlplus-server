import fs from "fs";
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import Settings from "./settings.js";
import onChange from "on-change";
import DeviceSource from "./deviceSource.js";
import SlvCtrlPlusSerialDeviceProvider from "../device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js";
import Logger from "../logging/Logger.js";

export default class SettingsManager
{
    private readonly settingsFilePath: string;

    private settings: Settings|null = null;

    private readonly plainToClassSerializer: PlainToClassSerializer;

    private readonly classToPlainSerializer: ClassToPlainSerializer;

    private readonly logger: Logger;

    public constructor(
        settingsFilePath: string,
        plainToClassSerializer: PlainToClassSerializer,
        classToPlainSerializer: ClassToPlainSerializer,
        logger: Logger
    ) {
        this.settingsFilePath = settingsFilePath;
        this.plainToClassSerializer = plainToClassSerializer;
        this.classToPlainSerializer = classToPlainSerializer;
        this.logger = logger;
    }

    public load(): Settings {
        if (null !== this.settings) {
            return this.settings;
        }

        let tmpSettings: Settings;

        if (!fs.existsSync(this.settingsFilePath)) {
            tmpSettings = new Settings();

            const defaultDeviceSource = new DeviceSource();
            defaultDeviceSource.id = 'b6a0f45e-c3d0-4dca-ab81-7daac0764291';
            defaultDeviceSource.type = SlvCtrlPlusSerialDeviceProvider.name;
            defaultDeviceSource.config = {};

            tmpSettings.addDeviceSource(defaultDeviceSource);
        } else {
            tmpSettings = this.plainToClassSerializer.transform(
                Settings,
                JSON.parse(fs.readFileSync(this.settingsFilePath, 'utf8'))
            );

            this.logger.info(`Settings loaded from file: ${this.settingsFilePath}`);
        }

        this.settings = onChange(tmpSettings,  () => this.save());

        return this.settings;
    }

    private save(): void {
        try {
            fs.writeFileSync(
                this.settingsFilePath,
                JSON.stringify(this.classToPlainSerializer.transform(this.settings), null, 4)
            );
            this.logger.debug(`Settings saved to '${this.settingsFilePath}' due to a change`);
        } catch (err: unknown) {
            this.logger.error(
                `Could not save settings file to '${this.settingsFilePath}': ${(err as Error).message}`,
                err
            );
        }
    }
}