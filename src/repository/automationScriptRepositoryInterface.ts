import AutomationScript from "../entity/automationScript.js";

export default interface AutomationScriptRepositoryInterface
{
    getAll(): AutomationScript[];

    getByName(name: string): string|null;

    save(fileName: string, data: string): void;
}
