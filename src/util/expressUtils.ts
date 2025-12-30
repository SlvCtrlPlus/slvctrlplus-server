import type { Request, Response } from 'express';
import type { Pimple } from '@timesplinter/pimple';
import type ServiceMap from '../serviceMap.js';

export type ControllerKey = {
    [K in keyof ServiceMap]: K extends `controller.${string}` ? K : never
}[keyof ServiceMap];

export const executeController = (
    container: Pimple<ServiceMap>,
    controllerName: ControllerKey
): (req: Request, res: Response) => void | Promise<void> => {
    return (req: Request, res: Response) => container.get(controllerName).execute(req, res);
}
