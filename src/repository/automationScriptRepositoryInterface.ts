import AutomationScript from '../entity/automationScript.js';

type AutomationScriptRepositoryInterface = {
    getAll(): AutomationScript[];

    getByName(name: string): string|null;

    save(fileName: string, data: string): void;

    delete(fileName: string): void;
}
export default AutomationScriptRepositoryInterface
