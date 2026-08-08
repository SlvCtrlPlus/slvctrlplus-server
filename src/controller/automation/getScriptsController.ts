import type { Request, Response } from 'express';
import type ControllerInterface from '../controllerInterface.js';
import type AutomationScriptRepositoryInterface from '../../repository/automationScriptRepositoryInterface.js';
import type ClassToPlainSerializer from '../../serialization/classToPlainSerializer.js';
import List from '../../entity/list.js';
import type AutomationScript from '../../entity/automationScript.js';

export default class GetScriptsController implements ControllerInterface
{
    private readonly automationScriptRepository: AutomationScriptRepositoryInterface;

    private readonly serializer: ClassToPlainSerializer;

    public constructor(
        automationScriptRepository: AutomationScriptRepositoryInterface,
        serializer: ClassToPlainSerializer,
    ) {
        this.automationScriptRepository = automationScriptRepository;
        this.serializer = serializer;
    }

    public execute(req: Request, res: Response): void
    {
        const list = new List<AutomationScript>(this.automationScriptRepository.getAll());

        res.json(this.serializer.transform(list));
    }
}
