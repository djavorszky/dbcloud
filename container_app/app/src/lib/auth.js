var validate_password = process.env.VALIDATE_PASSWORD;
var ldapjs = require('ldapjs');
var User = require(process.env.APP_ROOT + '/lib/db_registry.js').user;

var isAdmin = (function(username, cb) {
  process.nextTick(function() {
    var query = {username: username, isAdmin: 1};
    User.find(
      query)
    .lean()
    .exec(
      function(isAdminErr, isAdminRes) {
      if (isAdminErr) { return cb(isAdminErr); }
      console.log(isAdminRes);
      console.log(isAdminRes.length);
      if (isAdminRes.length === 1) {
        return cb(null, 1);
      } else {
        return cb(null, 0);
      }
    });
  });
});

var isFirstUser = (function(username, cb) {
  process.nextTick(function() {
    User.count({}, function(mongoose_err, count) {
      if (mongoose_err) {
        return cb(mongoose_err);
      } else {
        if (count === 1) {
          return cb(null, 1);
        } else {
          return cb(null, 0);
        }
      }
    });
  });
});

var upsertUser = (function(username, cb) {
  process.nextTick(function() {
    User.findOneAndUpdate({username: username},
      {username: username},
      {upsert: true}, function(user_err, user_res) {
        if (user_err) {
          return cb(user_err);
        } else {
          cb(null);
        }
      });
  });
});

var setAdmin = (function(username, cb) {
  process.nextTick(function() {
    User.findOneAndUpdate(
      {username: username},
      {$set: {isAdmin: 1}},
      function(setAdminErr, setAdminRes) {
        if (setAdminErr) { return cb(setAdminErr); }
        setAdminRes.save(function(objSaveErr) {
          if (objSaveErr) {
            return cb(objSaveErr);
          }
          return cb(null);
        });
      });
  });
});

var validateUserName = (function(username, cb) {
  process.nextTick(function() {
    if (username.length < 3) {
      return cb('username is too short');
    } else if (username.indexOf('.') == -1) {
      return cb('username must contain .');
    } else {
      cb(null);
    }
  });
});

var validateLdap = (function(username, password, cb) {
  process.nextTick(function() {
    var client = ldapjs.createClient({
      url: process.env.LDAP_SERVER
    });
    client.on('error', function(err) {
      cb('error while authenticating with LR ldap server: ' + err);
    });
    client.bind('cn=' + username, password, function(err) {
      if (err) { return cb(err, 'failed'); }
      cb(null,'authenticated');
    });
  });
});

var auth = (function(username, password, cb) {
  process.nextTick(function() {
    validateUserName(username, function(err) {
      if (err) { return cb(err); }
      if (validate_password == 1) {
        validateLdap(username, password, function(err) {
          if (err) { return cb(err); }
          upsertUser(username, function(err) {
            if (err) { return cb(err); }
            cb(null);
          });
        });
      } else {
        upsertUser(username, function(err) {
          if (err) { return cb(err); }
        });
        cb(null,'authenticated');
      }
    });
  });
});

module.exports.isFirstUser = isFirstUser;
module.exports.auth = auth;
module.exports.setAdmin = setAdmin;
module.exports.isAdmin = isAdmin;
