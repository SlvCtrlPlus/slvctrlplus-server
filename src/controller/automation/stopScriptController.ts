import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type ControllerInterface from '../controllerInterface.js';
import type ScriptRuntime from '../../automation/scriptRuntime.js';

export default class StopScriptController implements ControllerInterface
{
    private readonly scriptRuntime: ScriptRuntime;

    public constructor(scriptRuntime: ScriptRuntime)
    {
        this.scriptRuntime = scriptRuntime;
    }

    public async execute(req: Request, res: Response): Promise<void>
    {
        await this.scriptRuntime.stop();

        res.sendStatus(StatusCodes.OK);
    }
}
