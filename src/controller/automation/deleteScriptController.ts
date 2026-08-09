import type { Request, Response } from 'express';
import type ControllerInterface from '../controllerInterface.js';
import type AutomationScriptRepositoryInterface from '../../repository/automationScriptRepositoryInterface.js';
import { isValidAutomationScriptFileName } from '../../automation/utils.js';
import { StatusCodes } from 'http-status-codes';

type RequestParams = { fileName: string };
type DeleteScriptRequest = Request<RequestParams>;

export default class DeleteScriptController implements ControllerInterface
{
    private readonly automationScriptRepository: AutomationScriptRepositoryInterface;

    public constructor(
        automationScriptRepository: AutomationScriptRepositoryInterface,
    ) {
        this.automationScriptRepository = automationScriptRepository;
    }

    public execute(req: DeleteScriptRequest, res: Response): void
    {
        const { fileName } = req.params;

        if (!isValidAutomationScriptFileName(fileName)) {
            res.status(StatusCodes.BAD_REQUEST).send(`Invalid filename: ${fileName}`);
            return;
        }

        this.automationScriptRepository.delete(fileName);

        res.sendStatus(StatusCodes.NO_CONTENT);
    }
}
