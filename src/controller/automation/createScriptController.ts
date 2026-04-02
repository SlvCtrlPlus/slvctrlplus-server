import { Request, Response } from 'express';
import ControllerInterface from '../controllerInterface.js';
import AutomationScriptRepositoryInterface from '../../repository/automationScriptRepositoryInterface.js';
import { isValidAutomationScriptFileName } from '../../automation/utils.js';

type RequestParams = { fileName: string };
type RequestBody = string;
type CreateScriptRequest = Request<RequestParams, any, RequestBody>;

export default class CreateScriptController implements ControllerInterface
{
    private readonly automationScriptRepository: AutomationScriptRepositoryInterface;

    public constructor(
        automationScriptRepository: AutomationScriptRepositoryInterface
    ) {
        this.automationScriptRepository = automationScriptRepository;
    }

    public execute(req: CreateScriptRequest, res: Response): void
    {
        const matchedContentType = req.is('text/plain');

        if(false === matchedContentType || null === matchedContentType) {
            res.status(400).send('Content-Type header must be text/plain');
            return;
        }

        const { fileName } = req.params;

        if (!isValidAutomationScriptFileName(fileName)) {
            res.status(400).send(`Invalid filename: ${fileName}`);
            return;
        }

        this.automationScriptRepository.save(fileName, req.body);

        res.header('Content-Type', 'text/plain').status(201).end(req.body);
    }
}
