import AutomationScript from "../entity/automationScript.js";
import AutomationScriptRepositoryInterface from "./automationScriptRepositoryInterface.js";
import fs from "fs";

export default class AutomationScriptRepository implements AutomationScriptRepositoryInterface
{

    private readonly location: string;

    public constructor(location: string)
    {
        this.location = location;
    }

    public getAll(): AutomationScript[]
    {
        const scripts: AutomationScript[] = [];
        const files = fs.readdirSync(this.location);

        for (const file of files) {
            scripts.push(new AutomationScript(file));
        }

        return scripts;
    }

    public getByName(name: string): string|null
    {
        try {
            return fs.readFileSync(`${this.location}${name}`).toString();
        } catch (e: unknown) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }

            throw e;
        }
    }

    public save(fileName: string, data: string): void
    {
        fs.writeFileSync(`${this.location}${fileName}`, data);
    }

    public delete(fileName: string): void
    {
        fs.unlinkSync(`${this.location}${fileName}`);
    }
}
