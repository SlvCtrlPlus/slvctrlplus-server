import { Request, Response } from 'express';

export default interface ControllerInterface<Req extends Request = Request, Res extends Response = Response>
{
    execute(req: Req, res: Res): void | Promise<void>;
}
