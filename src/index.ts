import 'dotenv/config';
import 'reflect-metadata';
import {app,logger} from "./app.js";

const APP_PORT = process.env.PORT;

app.listen(APP_PORT, () => {
    logger.info(`Node version: ${process.version}`);
    logger.info(`SlvCtrl+ server listening on port ${APP_PORT}!`);
});
