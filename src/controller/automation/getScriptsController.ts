import { Request, Response } from 'express';
import ControllerInterface from "../controllerInterface.js";
import AutomationScriptRepositoryInterface from "../../repository/automationScriptRepositoryInterface.js";
import ClassToPlainSerializer from "../../serialization/classToPlainSerializer.js";
import List from "../../entity/list.js";
import AutomationScript from "../../entity/automationScript.js";

export default class GetScriptsController implements ControllerInterface
{
    private readonly automationScriptRepository: AutomationScriptRepositoryInterface;

    private serializer: ClassToPlainSerializer;

    public constructor(
        automationScriptRepository: AutomationScriptRepositoryInterface,
        serializer: ClassToPlainSerializer
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
