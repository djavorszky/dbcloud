var networkKey = process.env.NETWORK_KEY;
var logger = require('zmq-log-sender');

var Tokens = require(process.env.APP_ROOT +
    '/lib/db_registry.js').token;
var dbhandler = require(process.env.APP_ROOT + '/lib/db_handler.js');

var getUser = (function(token, cb) {
  if (token == networkKey) {
    logger('service authenticated with network key');
    return cb(null, {
      username: 'services.maintenance'
    });
  }
  Tokens.find({token_id: token}).lean().exec(function(token_err, token_res) {
    if (token_err) {
      return cb('auth: ' + err);
    }
    if (token_res.length < 1) {
      console.log('no token');
      return cb('no token');
    }
    var token_username = token_res[0].username;
    cb(null, {
      username: token_username
    });
  });
});

var getAdmin = (function(token, cb) {
  getUser(token, function(err, user) {
    if (err) {
      console.log('error: ' + err);
      return cb(err);
    }
    if (user.username == 'gyula.weber' ||
        user.username == 'zoltan.takacs' ||
        user.username == 'services.maintenance') {
          cb(null, {username: user.username});
        } else {
          return cb('not an admin: ' + username);
        }
  });
});

module.exports.getAdmin = getAdmin;
module.exports.getUser = getUser;

