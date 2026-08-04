import { Request, Response } from 'express';

type ControllerInterface = {
    execute(req: Request, res: Response): void | Promise<void>;
};

export default ControllerInterface;
