import type { Request, Response } from 'express';

type ControllerInterface = {
    // Method syntax: controllers narrow req's generic Request<Params, ...> per-route (see
    // GetDeviceController, PatchDeviceController, etc.); property syntax would check
    // contravariantly and reject that narrowing.
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    execute(req: Request, res: Response): void | Promise<void>;
};

export default ControllerInterface;
