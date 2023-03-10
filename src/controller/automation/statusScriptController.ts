import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface.js";
import ScriptRuntime from "../../automation/scriptRuntime.js";

export default class StatusScriptController implements ControllerInterface
{
    private readonly scriptRuntime: ScriptRuntime;

    public constructor(scriptRuntime: ScriptRuntime)
    {
        this.scriptRuntime = scriptRuntime;
    }

    public execute(req: Request, res: Response): void
    {
        const response = {
            running: this.scriptRuntime.isRunning(),
            runningSince: this.scriptRuntime.getRunningSince(),
        };

        res.status(200).json(response);
    }
}
