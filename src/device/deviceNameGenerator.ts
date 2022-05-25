import {Config, uniqueNamesGenerator} from "unique-names-generator";

export default class DeviceNameGenerator
{
    private readonly config: Config;

    public constructor(config: Config) {
        this.config = config;
    }

    public generateName(): string {
        return uniqueNamesGenerator(this.config);
    }
}
