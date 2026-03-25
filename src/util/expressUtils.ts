import type { Request, Response } from 'express';
import type { Pimple } from '@timesplinter/pimple';
import type ServiceMap from '../serviceMap.js';
import ControllerInterface from '../controller/controllerInterface.js';

export type ControllerKey = {
    [K in keyof ServiceMap]: K extends `controller.${string}` ? K : never
}[keyof ServiceMap];

export const executeController = <K extends ControllerKey>(
    container: Pimple<ServiceMap>,
    controllerName: K
): (req: Request, res: Response) => void | Promise<void> => {
    const controller: ControllerInterface = container.get(controllerName);
    return (req: Request, res: Response) => controller.execute(req, res);
}
