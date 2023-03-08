import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface.js";
import AutomationScriptRepositoryInterface from "../../repository/automationScriptRepositoryInterface.js";

export default class DeleteScriptController implements ControllerInterface
{
    private readonly automationScriptRepository: AutomationScriptRepositoryInterface;

    public constructor(
        automationScriptRepository: AutomationScriptRepositoryInterface
    ) {
        this.automationScriptRepository = automationScriptRepository;
    }

    public execute(req: Request, res: Response): void
    {
        const { fileName } = req.params;
        this.automationScriptRepository.delete(fileName);

        res.sendStatus(204);
    }
}
