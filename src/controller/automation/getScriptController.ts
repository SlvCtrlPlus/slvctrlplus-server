import type { Request, Response } from 'express';
import type ControllerInterface from '../controllerInterface.js';
import type AutomationScriptRepositoryInterface from '../../repository/automationScriptRepositoryInterface.js';
import { isValidAutomationScriptFileName } from '../../automation/utils.js';
import { StatusCodes } from 'http-status-codes';

type RequestParams = {
    fileName: string;
};

type GetScriptRequest = Request<RequestParams>;

export default class GetScriptController implements ControllerInterface
{
    private readonly automationScriptRepository: AutomationScriptRepositoryInterface;

    public constructor(
        automationScriptRepository: AutomationScriptRepositoryInterface,
    ) {
        this.automationScriptRepository = automationScriptRepository;
    }

    public execute(req: GetScriptRequest, res: Response): void
    {
        const { fileName } = req.params;

        if (!isValidAutomationScriptFileName(fileName)) {
            res.status(StatusCodes.BAD_REQUEST).send(`Invalid filename: ${fileName}`);
            return;
        }

        const scriptContent = this.automationScriptRepository.getByName(fileName);

        if (null === scriptContent) {
            res.sendStatus(StatusCodes.NOT_FOUND);
            return;
        }

        res.header('Content-Type', 'text/plain').status(StatusCodes.OK).end(scriptContent);
    }
}
