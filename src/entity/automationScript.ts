import {Exclude, Expose} from 'class-transformer';
import fs from "fs";

@Exclude()
export default class AutomationScript
{
    @Expose()
    private readonly fileName: string;

    public constructor(fileName: string)
    {
        this.fileName = fileName;
    }

    public getFileName(): string
    {
        return this.fileName;
    }

    public getContent(): string
    {
        return fs.readFileSync(this.fileName, 'utf8');
    }

    public setContent(data: string)
    {
        fs.writeFileSync(this.fileName, data);
    }
}
