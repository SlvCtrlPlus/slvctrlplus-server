import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface.js";
import AutomationScriptRepositoryInterface from "../../repository/automationScriptRepositoryInterface.js";
import ScriptRuntime from "../../automation/scriptRuntime.js";

export default class GetLogController implements ControllerInterface
{
    private readonly scriptRuntime: ScriptRuntime;

    public constructor(scriptRuntime: ScriptRuntime)
    {
        this.scriptRuntime = scriptRuntime;
    }

    public async execute(req: Request, res: Response): Promise<void>
    {
        const maxLogLines = Number(req.query.limit) || 500;

        try {
            const lines = await this.scriptRuntime.getLog(maxLogLines)

            res.header('Content-Type', 'text/plain').status(200).end(lines);
        } catch (e: unknown) {
            res.write((e as Error).message);
            res.header('Content-Type', 'text/plain').sendStatus(500);
        }
    }
}
