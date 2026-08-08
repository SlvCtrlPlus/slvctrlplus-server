import type { Request, Response } from 'express';
import type ControllerInterface from '../controllerInterface.js';
import type AutomationScriptRepositoryInterface from '../../repository/automationScriptRepositoryInterface.js';
import { isValidAutomationScriptFileName } from '../../automation/utils.js';
import { StatusCodes } from 'http-status-codes';

type RequestParams = {
    fileName: string;
};
type RequestBody = string;
type CreateScriptRequest = Request<RequestParams, unknown, RequestBody>;

export default class CreateScriptController implements ControllerInterface
{
    private readonly automationScriptRepository: AutomationScriptRepositoryInterface;

    public constructor(
        automationScriptRepository: AutomationScriptRepositoryInterface,
    ) {
        this.automationScriptRepository = automationScriptRepository;
    }

    public execute(req: CreateScriptRequest, res: Response): void
    {
        const matchedContentType = req.is('text/plain');

        if (false === matchedContentType || null === matchedContentType) {
            res.status(StatusCodes.BAD_REQUEST).send('Content-Type header must be text/plain');
            return;
        }

        const { fileName } = req.params;

        if (!isValidAutomationScriptFileName(fileName)) {
            res.status(StatusCodes.BAD_REQUEST).send(`Invalid filename: ${fileName}`);
            return;
        }

        this.automationScriptRepository.save(fileName, req.body);

        res.header('Content-Type', 'text/plain').status(StatusCodes.CREATED).end(req.body);
    }
}
