import { Request, Response, NextFunction } from 'express';

export default (req: Request, res: Response, next: NextFunction): void => {
    const supportedContentType = 'application/json';

    if ('POST' === req.method && !req.is(supportedContentType)) {
        res.status(400).send('Content-Type header must be application/json');
        return;
    }

    if (!req.accepts(supportedContentType)) {
        res.status(406).send('Accept header must be application/json');
        return;
    }

    next();
}
