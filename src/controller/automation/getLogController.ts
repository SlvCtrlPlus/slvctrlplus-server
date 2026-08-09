import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import BaseError from 'modern-errors';
import type ControllerInterface from '../controllerInterface.js';
import type ScriptRuntime from '../../automation/scriptRuntime.js';

export default class GetLogController implements ControllerInterface
{
    private static readonly DEFAULT_MAX_LOG_LINES = 500;

    private readonly scriptRuntime: ScriptRuntime;

    public constructor(scriptRuntime: ScriptRuntime)
    {
        this.scriptRuntime = scriptRuntime;
    }

    public async execute(req: Request, res: Response): Promise<void>
    {
        const maxLogLines = Number(req.query.limit) || GetLogController.DEFAULT_MAX_LOG_LINES;

        try {
            const lines = await this.scriptRuntime.getLog(maxLogLines);

            res.header('Content-Type', 'text/plain').status(StatusCodes.OK).end(lines);
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            res.header('Content-Type', 'text/plain').status(StatusCodes.INTERNAL_SERVER_ERROR).end(error.message);
        }
    }
}
