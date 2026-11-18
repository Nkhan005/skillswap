'use strict';

const http = require('node:http');

const env = require('./config/env');
const createApp = require('./app');
const { connectWithRetry, disconnectDB } = require('./config/db');
const { initSocketServer } = require('./sockets');
const logger = require('./utils/logger');

async function bootstrap() {
  const app = createApp();
  // Socket.io and Express share one HTTP server so both answer on PORT.
  const server = http.createServer(app);

  initSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info(`SkillSwap API listening on :${env.PORT} (${env.NODE_ENV})`);
    logger.info(`CORS origins: ${env.CLIENT_ORIGIN.join(', ')}`);
  });

  // Started after listening, and deliberately not awaited. Binding the port
  // first means a database that is slow, paused or briefly unreachable
  // cannot stop the process starting: the client is still served and
  // /api/health reports 503 until the connection is live. Awaiting here is
  // what turned a paused Atlas cluster into an endless restart loop.
  connectWithRetry();

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  bootstrap().catch((err) => {
    logger.error(`Startup failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = bootstrap;
