import { Request, Response } from 'express';

export default interface ControllerInterface
{
    execute(req: Request, res: Response): void;
}
