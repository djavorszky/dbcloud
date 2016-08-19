REDIS_HOST = process.env.REDIS_HOST;
REDIS_PORT = process.env.REDIS_PORT;
MYHOST = process.env.MYHOST;
EXPOSED_PORT = process.env.EXPOSED_PORT;
APP_ROOT = process.env.APP_ROOT;

var kue = require('kue');
var queue = kue.createQueue({redis: {host: REDIS_HOST}});

require('./queue_jobs.js')(queue); // FIXME

