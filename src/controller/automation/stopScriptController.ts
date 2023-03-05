import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface.js";
import ScriptRuntime from "../../automation/scriptRuntime.js";

export default class StopScriptController implements ControllerInterface
{
    private readonly scriptRuntime: ScriptRuntime;

    public constructor(scriptRuntime: ScriptRuntime)
    {
        this.scriptRuntime = scriptRuntime;
    }

    public execute(req: Request, res: Response): void
    {
        this.scriptRuntime.unload();

        res.sendStatus(200);
    }
}
