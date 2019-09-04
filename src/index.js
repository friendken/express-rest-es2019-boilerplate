// make bluebird default Promise
import '@babel/polyfill';
import { port, env } from './config/vars';
import logger from './config/logger';
import app from './config/express';
import * as mongoose from './config/mongoose';

Promise = require('bluebird'); // eslint-disable-line no-global-assign

// open mongoose connection
mongoose.connect();

// listen to requests
app.listen(port, () => logger.info(`server started on port ${port} (${env})`));

/**
* Exports express
* @public
*/
export default app;
