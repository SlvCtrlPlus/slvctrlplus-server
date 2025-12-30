import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface.js";
import AutomationScriptRepositoryInterface from "../../repository/automationScriptRepositoryInterface.js";
import {isValidAutomationScriptFileName} from "../../automation/utils.js";

export default class GetScriptController implements ControllerInterface
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

        if (!isValidAutomationScriptFileName(fileName)) {
            res.status(400).send(`Invalid filename: ${fileName}`);
            return;
        }

        const scriptContent = this.automationScriptRepository.getByName(fileName);

        if (null === scriptContent) {
            res.sendStatus(404);
            return;
        }

        res.header('Content-Type', 'text/plain').status(200).end(scriptContent);
    }
}
