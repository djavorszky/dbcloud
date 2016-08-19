'use strict';

var dbhandler = require(process.env.APP_ROOT + '/lib/db_handler.js');
var create_database = require(process.env.APP_ROOT + '/lib/create_database.js');
var generateName = require(process.env.APP_ROOT + '/lib/generateName.js');
var Tokens = require(process.env.APP_ROOT + '/lib/db_registry.js').token;

var auth = require(process.env.APP_ROOT + '/lib/auth.js');
var logger = require('zmq-log-sender');

exports.databaseBackendDELETE = function(args, res, next) {
  /**
   * parameters expected in the args:
  * token (String)
  * serverName (String)
  **/
  // no response value expected for this operation

  res.end();
}

exports.databaseBackendGET = function(args, res, next) {
  /**
   * parameters expected in the args:
  * token (String)
  * serverName (String)
  **/

  var examples = {};
  examples['application/json'] = {
  "server_name" : "aeiou",
  "admin_username" : "aeiou",
  "server_ip" : "aeiou",
  "server_port" : "aeiou",
  "admin_password" : "aeiou"
};

  if(Object.keys(examples).length > 0) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(examples[Object.keys(examples)[0]] || {}, null, 2));
  }
  else {
    res.end();
  }
}

exports.databaseBackendPOST = function(args, res, next) {
  /**
   * parameters expected in the args:
  * token (String)
  * serverName (String)
  * serverHost (String)
  * serverIp (String)
  * adminUsername (String)
  * adminPassword (String)
  **/
  // no response value expected for this operation

  res.end();
}

exports.databaseBackendsGET = function(args, res, next) {
  /**
   * parameters expected in the args:
  * token (String)
  **/

  var token = args.token.value;
  logger('apiserver > serving getDatabaseBackends');

  auth.getUser(token, function(err, user) {
    if (err) {
      logger('apiserver > error in getUser: ' + err);
      console.log('error: ' + err);
      res.statusCode = 500;
      res.end();
      return;
    }

    if (user.username != 'gyula.weber' && user.username != 'zoltan.takacs' &&
      user.username != 'services.maintenance') {
      res.statusCode = 500;
      res.end();
      console.log('not authorized');
      logger('apiserver > not an admin user: ' + user.username);
      return;
    }


    dbhandler.getDatabaseServers(function(err, servers) {
      if (err) {
        console.log('bad things will likely to happen');
        res.statusCode = 500;
        res.end();
        return;
      }
      console.log('got something for ya');
      console.log(servers);
      // var examples = {};
      // examples['application/json'] = [ {
      //   "server_name" : "aeiou",
      // "admin_username" : "aeiou",
      // "server_ip" : "aeiou",
      // "server_port" : "aeiou",
      // "admin_password" : "aeiou"
      // } ];

      if(servers.length > 0) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(servers));
      }
      else {
        res.end();
      }
    });

  });
}

