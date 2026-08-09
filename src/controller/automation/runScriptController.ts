import type { Request, Response } from 'express';
import type ControllerInterface from '../controllerInterface.js';
import type ScriptRuntime from '../../automation/scriptRuntime.js';
import { StatusCodes } from 'http-status-codes';

type RunScriptRequest = Request<unknown, unknown, string>;

export default class RunScriptController implements ControllerInterface
{
    private readonly scriptRuntime: ScriptRuntime;

    public constructor(scriptRuntime: ScriptRuntime)
    {
        this.scriptRuntime = scriptRuntime;
    }

    public async execute(req: RunScriptRequest, res: Response): Promise<void>
    {
        const matchedContentType = req.is('text/plain');

        if (false === matchedContentType || null === matchedContentType) {
            res.status(StatusCodes.BAD_REQUEST).send('Content-Type header must be text/plain');
            return;
        }

        const scriptCode = req.body;

        await this.scriptRuntime.load(scriptCode);

        const response = {
            running: this.scriptRuntime.isRunning(),
            runningSince: this.scriptRuntime.getRunningSince(),
        };

        res.status(StatusCodes.OK).json(response);
    }
}
