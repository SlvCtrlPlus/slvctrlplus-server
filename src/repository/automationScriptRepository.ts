import path from 'path';
import AutomationScript from '../entity/automationScript.js';
import { hasProperty } from '../util/objects.js';
import AutomationScriptRepositoryInterface from './automationScriptRepositoryInterface.js';
import fs from 'fs';

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
            return fs.readFileSync(this.resolveScriptPath(name), 'utf8');
        } catch (e: unknown) {
            if (hasProperty(e, 'code') && e.code === 'ENOENT') {
                return null;
            }

            throw e;
        }
    }

    public save(fileName: string, data: string): void
    {
        fs.writeFileSync(this.resolveScriptPath(fileName), data);
    }

    public delete(fileName: string): void
    {
        fs.unlinkSync(this.resolveScriptPath(fileName));
    }

    private resolveScriptPath(fileName: string): string
    {
        const resolved = path.resolve(this.location, fileName);
        const relative = path.relative(this.location, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error(`Invalid script path: ${fileName}`);
        }
        return resolved;
    }
}
