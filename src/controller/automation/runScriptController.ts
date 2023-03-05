import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface.js";
import ScriptRuntime from "../../automation/scriptRuntime.js";

export default class RunScriptController implements ControllerInterface
{
    private readonly scriptRuntime: ScriptRuntime;

    public constructor(scriptRuntime: ScriptRuntime)
    {
        this.scriptRuntime = scriptRuntime;
    }

    public execute(req: Request, res: Response): void
    {
        if(!req.is('text/plain')) {
            res.status(400).send('Content-Type header must be text/plain');
            return;
        }

        const scriptCode = req.body as string;

        this.scriptRuntime.load(scriptCode);

        res.sendStatus(200);
    }
}
