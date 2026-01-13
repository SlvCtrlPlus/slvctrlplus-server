import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface.js";
import AutomationScriptRepositoryInterface from "../../repository/automationScriptRepositoryInterface.js";
import {isValidAutomationScriptFileName} from "../../automation/utils.js";

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

        if (!isValidAutomationScriptFileName(fileName as string)) {
            res.status(400).send(`Invalid filename: ${fileName}`);
            return;
        }

        this.automationScriptRepository.delete(fileName as string);

        res.sendStatus(204);
    }
}
