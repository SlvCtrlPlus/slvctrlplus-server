import { Request, Response } from 'express';
import ControllerInterface from "./controllerInterface.js";
import ClassToPlainSerializer from "../serialization/classToPlainSerializer.js";
import RuleDefinitionList from "../entity/automation/rule/ruleDefinitionList.js";
import RuleDefinitionRepositoryInterface from "../repository/ruleDefinitionRepositoryInterface.js";

export default class GetRulesController implements ControllerInterface
{
    private ruleDefinitionRepository: RuleDefinitionRepositoryInterface;

    private serializer: ClassToPlainSerializer;

    public constructor(ruleDefinitionRepository: RuleDefinitionRepositoryInterface, serializer: ClassToPlainSerializer)
    {
        this.ruleDefinitionRepository = ruleDefinitionRepository;
        this.serializer = serializer;
    }

    public execute(req: Request, res: Response): void
    {
        const list = new RuleDefinitionList(this.ruleDefinitionRepository.getAll());

        res.json(this.serializer.transform(list));
    }
}
