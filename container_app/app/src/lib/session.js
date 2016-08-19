
var session = require('express-session');
var sharedsession = require('express-socket.io-session');
var RedisStore = require('connect-redis')(session);
var redis = require('redis');
var redisClient = redis.createClient({'host': REDIS_HOST});
var store = new RedisStore({host: REDIS_HOST, port: REDIS_PORT,
  client: redisClient, ttl: 14400});

var session_setup = function(app, io) {
  app.use(session({
    store: store,
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: true
  }));
  io.use(sharedsession(session({
    store: store, secret: SESSION_SECRET,
    resave: true, saveUninitialized: true}), {
    autoSave: true,
    secret: SESSION_SECRET
  }));

  // redisClient is used by the session handler, it persists data in redis.
  redisClient.on('error', function(err) {
    console.log('Error ' + err);
  });

  redisClient.on('ready', function(err) {
    console.log('redis session handler connected');
  });

  redisClient.on('reconnecting', function(err) {
    console.log('session handler reconnecting(redis)');
  });
};

module.exports = session_setup;
