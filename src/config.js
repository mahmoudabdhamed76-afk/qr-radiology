'use strict';
/* Every setting that comes from the environment, in one place. */
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  ROOT,
  PORT: Number(process.env.PORT || 3450),
  HOST: process.env.HOST || '0.0.0.0',
  DATA_DIR: process.env.DATA_DIR || path.join(ROOT, 'data'),
  PUBLIC_DIR: path.join(ROOT, 'public'),
  /* first admin password; if set it always wins (handy on Railway) */
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  /* sample centers / supplies / orders on an empty database (SEED_DEMO=0 to start empty) */
  SEED_DEMO: process.env.SEED_DEMO !== '0',
  TZ: process.env.TZ_APP || 'Africa/Cairo',
  VERSION: '2.0.0'
};
