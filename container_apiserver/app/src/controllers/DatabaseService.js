'use strict';

var dbhandler = require(process.env.APP_ROOT + '/lib/db_handler.js');
var create_database = require(process.env.APP_ROOT + '/lib/create_database.js');
var generateName = require(process.env.APP_ROOT + '/lib/generateName.js');
var Tokens = require(process.env.APP_ROOT +
    '/lib/db_registry.js').token;
var Registry = require(process.env.APP_ROOT +
    '/lib/db_registry.js').registry;

var logger = require('zmq-log-sender');
var auth = require(process.env.APP_ROOT + '/lib/auth.js');

var kue = require('kue');
var queue = kue.createQueue({redis: {host: process.env.REDIS_HOST}});

exports.backendDatabasesGET = function(args, res, next) {
  /**
   * parameters expected in the args:
  * token (String)
  * backendName (String)
  **/

  // authenticate the request

  var token = args.token.value;
  var backend_name = args.backend_name.value;

  auth.getUser(token, function(err, user) {
    if (err) {
      logger('apiserver > error in getUser: ' + err);
      res.statusCode = 500;
      res.end();
      return;
    }

    // authenticated. so. create a command, send it to the worker,
    // parse the response, and return it to whoever wanted it.

    dbhandler.getDatabaseServer(backend_name, function(err, backend) {
      if (err) {
        res.statusCode = 500;
        res.end();
        console.log(err);
        return;
      }
      dbhandler.getDatabaseConnectString(backend, function(err, connectString) {
        if (err) {
          res.statusCode = 500;
          res.end();
          console.log(err);
          return;
        }
        dbhandler.createMysqlCommand(connectString, 'show databases',
        function(err, mysqlCommand) {
          if (err) {
            res.statusCode = 500;
            res.end();
            console.log(err);
            return;
          }
          var dblistJob = queue.create('db_operation', mysqlCommand)
          .save(function(err) {
            if (err) {
              res.statusCode = 500;
              res.end();
              console.log(err);
              return;
            }
            console.log('sending: ' + mysqlCommand);

            dblistJob.on('failed', function(err) {
              console.log('job failed: ' + err);
            });

            dblistJob.on('complete', function(jobResult) {
              console.log('job complete, sending result');
              var jobLines = jobResult.split('\n');
              var responseObject = [];
              jobLines.forEach(function(jobLine) {
                if (jobLine.length < 1 ||
                    jobLine == 'Database' ||
                    jobLine == 'mysql' ||
                    jobLine == 'information_schema' ||
                    jobLine == 'performance_schema' ||
                    jobLine == 'sys') {
                      // nothing
                    } else {
                      console.log('adding to response: ' + jobLine);
                      responseObject.push({
                        'name': jobLine,
                        'backend_name': backend_name
                      });
                    }
              });
              console.log('checking results....');
              console.log(responseObject);
              if(responseObject.length > 0) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(responseObject));
              }
              else {
                res.statusCode = 404;
                res.end();
              }
            });
          });
        });
      });

    });

  });
}

exports.databasesGET = function(args, res, next) {
  /**
   * parameters expected in the args:
  * token (String)
  * backendName (String)
  **/

  var token = args.token.value;
  var backend_name = args.backend_name.value;

  auth.getUser(token, function(err, user) {
    if (err) {
      logger('apiserver > error in getUser: ' + err);
      res.statusCode = 500;
      res.end();
      return;
    }

  Registry.find({db_server: backend_name}).lean().exec(function(err, docs) {
    if (err) {
      // return an error
      logger('error while getting db lists in backend ' +
        backend_name + ': ' +
        err);
      res.statusCode = 500;
      res.end();
      return;
    }
  if(docs.length > 0) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(docs));
  } else {
    res.statusCode = 404;
    res.end();
    return;
  }

  });

  // do a mongodb query to see which databased are supposed to
  // be in this backend server

  });

  var examples = {};
  examples['application/json'] = [ {
  "password" : "aeiou",
  "backend_name" : "aeiou",
  "name" : "aeiou",
  "username" : "aeiou"
} ];

}


exports.databaseDELETE = function(args, res, next) {
  /**
   * parameters expected in the args:
  * token (String)
  * name (String)
  **/
  // no response value expected for this operation


  res.end();
}

exports.databaseGET = function(args, res, next) {
  /**
   * parameters expected in the args:
  * token (String)
  * databaseName (String)
  **/


  var examples = {};
  examples['application/json'] = {
  "password" : "aeiou",
  "backend_name" : "aeiou",
  "name" : "aeiou",
  "username" : "aeiou"
};

  if(Object.keys(examples).length > 0) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(examples[Object.keys(examples)[0]] || {}, null, 2));
  }
  else {
    res.end();
  }


}

exports.databasePOST = function(args, res, next) {
  /**
   * parameters expected in the args:
  * token (String)
  * backendName (String)
  * name (String)
  * username (String)
  * password (String)
  **/
  // no response value expected for this operation

  // all parameters are optional, so we generate them if not exists

  // authenticate token

  var token = args.token.value;

  auth.getUser(token, function(err, username) {
     if (err) {
      console.log('no token (' + token + ') for name ' + args.name.value);
      res.statusCode = 500;
      res.end();
      return;
     }
    var token_username = username.username;
    console.log('token username: ' + token_username);

    var dbInfo = {
      db_username: generateName.generateIfEmpty(args.username.value),
      db_password: generateName.generateIfEmpty(args.password.value),
      db_server: args.backend_name.value,
      db_status_code: 'ok',
      username: token_username,
      request_email: false,
      db_name: generateName.generateIfEmpty(args.name.value)
    };

    console.log('raw arguments');
    console.log(args);

    console.log('create database on a given server');
    console.log(dbInfo);

    if (args.registryOnly.value == 'yes') {

      var backendInfo = dbhandler.getDatabaseServer(dbInfo.db_server, function(err, backendInfo) {
        dbInfo.db_host = backendInfo.host;
        dbInfo.db_port = backendInfo.port;

        console.log(' -- backend info --');
        console.log(backendInfo);
        console.log(' -- db info --');
        console.log(dbInfo);

        console.log('creating only in registry');
        var new_db = Registry(dbInfo);
        new_db.save(function(err) {
         if (err) {
           res.statusCode = 500;
           res.end();
           console.log('error creating database: ' + err);
           logger('error creating database: ' + err);
           return;
         }
         console.log('created registry-only database: ' + JSON.stringify(dbInfo));
         logger('created registry-only database: ' + JSON.stringify(dbInfo));

         res.setHeader('Content-Type', 'application/json');
         res.end(JSON.stringify(dbInfo));
         return;
        });

      });
    } else {

      var new_db = new create_database(dbInfo, function(db_err, db_res) {
        if (db_err) {
          console.log('error while trying to create a new database: ' + db_err);
          console.log('returning 500 error to the api client');

          // res.status(500).end();
          res.statusCode = 500;
          res.end();
          return;
        }
        console.log('db created; ' );
        console.log(db_res);

        if(Object.keys(db_res).length > 0) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(db_res || {}, null, 2));
        }
      });
    }
  });

}

exports.invalidateDatabaseGET = function(args, res, next) {
  /**
   * parameters expected in the args:
  * token (String)
  * dbName (String)
  **/
  // no response value expected for this operation

  var token = args.token.value;
  var dbname = args.db_name.value;
  if (typeof(dbname) == 'undefined') {
    res.statusCode = 500;
    res.end();
    console.log('dbname not defined, but I cant just guess');
    return;
  }
  console.log('invalidating database: ' + dbname);

  auth.getAdmin(token, function(err, user) {
    if (err) {
      logger('apiserver > error in invalidateDatabaseGet: ' + err);
      res.statusCode = 500;
      res.end();
      console.log('problem: ' + err);
      return;
    }
    Registry.findOneAndUpdate({db_name: dbname},
      {$set:
        {
          db_status_code: 'error',
          db_status_message: 'database not found on the actual backend'
        }
      }, function(err, something) {
        console.log('got data back');
        if (something === null) {
          console.log('not found');
          res.statusCode = 404;
          res.end();
          return;

        }
        if (err) {
          console.log('error while invalidating database');
          logger('apiserver > error in invalidateDatabaseGet: ' + err);
          res.statusCode = 500;
          res.end();
          console.log('problem: ' + err);
          return;
        } else {
          console.log('apiserver > database invalidated: ' + dbname);
          res.statusCode = 200;
          res.end();
          return;
        }
      });
  });
}
