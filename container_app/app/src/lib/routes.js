var login = require(
    process.env.APP_ROOT + '/lib/auth.js');

var queue_handler = require(process.env.APP_ROOT + '/lib/handle_queue.js');
var DBServers = require(process.env.APP_ROOT + '/lib/db_registry.js').dbservers;
var dbhandler = require(process.env.APP_ROOT + '/lib/db_handler.js');
var Token = require(process.env.APP_ROOT + '/lib/db_registry.js').token;
var randtoken = require('rand-token');
var async = require('async');
var renderer = require('render-ejs-template');

module.exports = (function(app, queue) {
  app.get('/', function(req, res) {
    var is_session_authenticated = 0;
    var username = 'unknown';

    if (typeof(req.session.is_authenticated) == 'undefined') {
      is_session_authenticated = 0;
      res.redirect('/login');
    } else {
      DBServers.find().lean().exec(function(err, docs) {
        is_session_authenticated = 1;
        username = req.session.username;
        res.render('pages/index',{
          'session_id': req.session.id,
          'is_session_authenticated': is_session_authenticated,
          username: username,
          dbservers: docs,
          is_admin: req.session.is_admin
        });
      });
    }
  });

  app.get('/getCurlScript', function(req, res) {
    if (typeof(req.session.is_authenticated) == 'undefined') {
      is_session_authenticated = 0;
      res.redirect('/login');
      return;
    }
    var username = req.session.username;
    var token;
    async.waterfall([
      function(cb) {
        Token.find({username: username}).lean().exec(function(err, token_res) {
          if (err) { return cb(err); }
          if (token_res.length < 1) {
            var new_token = new Token({
              token_id: randtoken.generate(16),
              username: username
            });
            new_token.save(function(err, res) {
              if (err) { return cb(err); }
              token = res.token_id;
              console.log('new token generated and saved: ' + token);
              return cb(null, token);
            });

            // generate token
          } else {
            token = token_res[0].token_id;
            console.log('using existsing token: ' + token);
            return cb(null, token);
          }
        });
      }, function(token, cb) {

        console.log('using token: ' + token);
        // generate script from ejs
        renderer(process.env.APP_ROOT +
          '/views/snipplets/script_cmdb.ejs', {
            token: token,
            MYHOST: process.env.MYHOST
          }, function(err, script_response) {
            if (err) {
              console.log(err);
              return cb(err);
            }
            cb(null, script_response);
          });

      }], function(err, f_res) {
        if (err) {
          console.log('generating token: error: ' + err);
          res.end(err);
        } else {
          console.log('token generated');
          console.log(f_res);
          res.end(f_res);
        }
      });

    // render a script template into the response

  });

  app.get('/mng_dbserver', function(req, res) {
    if (req.session.is_admin != 1) {
      res.redirect('/'); return;
    }
    dbhandler.getDatabaseServers(function(err, docs) {
      if (err) {
        console.log('err: ' + err);
        return;
      }
      res.render('pages/mng_dbserver', {
        username: req.session.username,
        is_admin: req.session.is_admin,
        dbservers: docs
      });

    });
    console.log('mng_dbserver');
  });

  app.get('/mng_queue', function(req, res) {
    res.render('pages/mng_queue_base', {
      username: req.session.username,
      is_admin: req.session.is_admin
    });
  });

  app.get('/mng_queue/inactive', function(req, res) {
    if (req.session.is_admin != 1) {
      res.redirect('/'); return;
    }

    queue_handler.getJobs('inactive', function(err, joblist) {
      if (err) { console.log('error: ' + err); return; }
      res.render('pages/mng_queue', {
        username: req.session.username,
        is_admin: req.session.is_admin,
        jobs: joblist
      });

    });

  });
  app.get('/mng_queue/active', function(req, res) {
    if (req.session.is_admin != 1) {
      res.redirect('/'); return;
    }

    queue_handler.getJobs('active', function(err, joblist) {
      if (err) { console.log('error: ' + err); return; }
      res.render('pages/mng_queue', {
        username: req.session.username,
        is_admin: req.session.is_admin,
        jobs: joblist
      });

    });

  });
  app.get('/mng_queue/failed', function(req, res) {
    if (req.session.is_admin != 1) {
      res.redirect('/'); return;
    }

    queue_handler.getJobs('failed', function(err, joblist) {
      if (err) { console.log('error: ' + err); return; }
      res.render('pages/mng_queue', {
        username: req.session.username,
        is_admin: req.session.is_admin,
        jobs: joblist
      });

    });

  });
  app.get('/mng_queue/completed', function(req, res) {
    if (req.session.is_admin != 1) {
      res.redirect('/'); return;
    }

    queue_handler.getJobs('complete', function(err, joblist) {
      if (err) { console.log('error: ' + err); return; }
      res.render('pages/mng_queue', {
        username: req.session.username,
        is_admin: req.session.is_admin,
        jobs: joblist
      });

    });

  });

  app.get('/mng_user', function(req, res) {
    if (req.session.is_admin != 1) {
      res.redirect('/'); return;
    }
    res.render('pages/mng_user', {
      username: req.session.username,
      is_admin: req.session.is_admin
    });
  });

  app.get('/login', function(req, res) {
    res.render('pages/login');
  });

  app.post('/login', function(req, res) {
    // TODO need to check the strings
    var username = req.body.login_username;
    var password = req.body.login_password;
    var login_result = login.auth(username, password, function(err, authres) {
      if (err) {
        console.log('error while trying to authenticate: ' + err);
        res.render('pages/error', {'message': err});
      } else {
        // see if its the first user
        console.log('login success');
        login.isFirstUser(username, function(login_err, login_res) {
          if (login_err) {
            res.redirect('/error');
          } else {
            console.log('authenticated');
            if (login_res === 1) {
              // first user, grant admin rights
              login.setAdmin(username, function(setAdminErr, setAdminRes) {
                if (setAdminErr) { console.log('handle it: ' + setAdminErr); }
                req.session.username = username;
                req.session.is_authenticated = 1;
                req.session.is_admin = 1;
                res.redirect('/');
              });
            } else {
              // not the first user, so check if she is an admin
              login.isAdmin(username, function(adminErr, adminRes) {
                if (adminErr) { console.log('handle error: ' + adminErr); }
                if (adminRes === 1) {
                  console.log(username + ' is admin');
                  req.session.is_admin = 1;
                } else {
                  console.log(username + ' is not admin');
                  req.session.is_admin = 0;
                }
                req.session.username = username;
                req.session.is_authenticated = 1;
                res.redirect('/');
              });
            }
          }
        });
      }
    });
  });

  app.get('/admin', function(req, res) {
    res.render('pages/admin');
  });

  app.get('/logout', function(req, res) {
    delete req.session.is_authenticated;
    delete req.session.username;
    delete req.session.is_admin;
    res.redirect('/');
  });
  app.get('/error', function(req, res) {
    res.render('pages/error');
  });

  // API functions

  // createDatabase
  // removeDatabase
  // grantPermissions

  app.post('/api/', function(req, res) {

    // Authenticate request
    var operation = req.body.operation;
    var apiKey = req.body.apiKey;
    var dbservers = require(
        process.env.APP_ROOT +
        '/lib/db_registry.js').dbservers;

    var enQueueCommand = function(queue, dbServer, dbQuery, isAsync, cb) {
      console.log('enQueue command ' + dbQuery + ', async: ' + isAsync);
      var query = {container: dbServer};
      dbservers.findOne(query, function(d_err, d_res) {
        if (d_err) {
          return cb(d_err);
        }
        if (d_res === null) {
          return cb('db server not found');
        }
        var db_connect_string = 'mysql -uroot -p' + process.env.SAMPLE_PASSWORD + ' -h' +
            d_res.host +
            ' -P ' +
            d_res.port;

        var db_import_command = db_connect_string +
          ' -e \'' + dbQuery + '\'';

        var db_import_job = queue.create('db_operation', db_import_command)
          .save(function(err) {
            if (err) {
              return cb(err);
            } else {
              if (isAsync === 1) {
                cb(null);
              }
            }
          });
        if (isAsync === 0) {
          db_import_job.on('complete', function(err) {
            cb(null);
          });

          db_import_job.on('failed', function(err) {
            cb(err);
          });
        }
      });
    };

    if (operation === 'createDatabase') {
      enQueueCommand(queue, req.body.dbServer,
        'create database ' + req.body.dbName, 0, function(db_err, db_res) {
        if (db_err) {
          console.log(db_err);
          res.json({
            result: 'FAILED',
            error: db_err
          });
          res.end();
        } else {
          res.json({
            result: 'OK',
            message: 'Database created'
          });
          res.end();

        }
      });
    } else if (operation === 'grantPermissions') {
      enQueueCommand(queue, req.body.dbServer,
        'grant all privileges on ' +
        req.body.dbName + '.*' +
        ' to "' + req.body.dbUsername + '"@"%"' +
        ' identified by "' + req.body.dbPassword + '"', 0,

        function(db_err, db_res) {
          if (db_err) {
            console.log(db_err);
            res.json({
              result: 'FAILED',
              error: db_err
            });
            res.end();
          } else {
            res.json({
              result: 'OK',
              message: 'permission granted'
            });
            res.end();
          }
        });
    } else if (operation === 'removeDatabase') {
      enQueueCommand(queue, req.body.dbServer,
        'drop database ' + req.body.dbName, 0, function(db_err, db_res) {
        if (db_err) {
          console.log(db_err);
          res.json({
            result: 'FAILED',
            error: db_err
          });
          res.end();
        } else {
          res.json({
            result: 'OK',
            message: 'Database removal completed'
          });
          res.end();
        }
      });
    } else {
      res.json({
        result: 'FAILED',
        error: 'unknown operation: ' + operation
      });
      res.end();
      return true;
    }
  });

});
