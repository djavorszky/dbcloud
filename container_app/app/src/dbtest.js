// Global variables, coming from the docker environment settings
// in docker-compose*.yml

REDIS_HOST = process.env.REDIS_HOST;
REDIS_PORT = process.env.REDIS_PORT;
BASE_DIR = process.env.BASE_DIR;
EXPOSED_PORT = process.env.EXPOSED_PORT;
SESSION_SECRET = process.env.SESSION_SECRET;
APP_ROOT = process.env.APP_ROOT;

// server core
var events = require('events');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var ejs = require('ejs');
var fs = require('fs');
var logger = require('zmq-log-sender');
var favicon = require('serve-favicon');
var os = require('os');
var auth = require(process.env.APP_ROOT + '/lib/auth.js');

var Zcomm = require('zmq-comm');

// wait a bit before reading interfaces
setTimeout(function() {
  var ifaces = os.networkInterfaces();
  var myAdvert = {
    name: 'log_sender',
    port: 1784,
    type: 'zmq',
    host: ifaces.eth0[0].address
  };
  var zAdvert = new Zcomm.AdvertiseService(myAdvert);

  zAdvert.on('error', function(err) {
    console.log(myAdvert);
    console.log('error on zAdvert: ' + err);
  });
}, 6000);

// database models
var Event = require(process.env.APP_ROOT + '/lib/db_registry.js').events;
var Registry = require(process.env.APP_ROOT + '/lib/db_registry.js').registry;
var Token = require(process.env.APP_ROOT + '/lib/db_registry.js').token;
var DBServer = require(process.env.APP_ROOT + '/lib/db_registry.js').dbservers;

var bodyParser = require('body-parser');
var moment = require('moment-timezone');

// queue related
var kue = require('kue');
var queue = kue.createQueue({redis: {host: process.env.REDIS_HOST}});

var clone_db = require(process.env.APP_ROOT + '/lib/clone_db.js');
var remove_db = require(process.env.APP_ROOT + '/lib/remove_db.js');
var show_file_list = require(process.env.APP_ROOT + '/lib/show_file_list.js');
var import_db = require(process.env.APP_ROOT + '/lib/import_database.js');

var renderEjsTemplate = require(
    process.env.APP_ROOT + '/lib/renderEjsTemplate.js');

var Umessage = require(process.env.APP_ROOT + '/lib/messageGw.js');
var renderer = require('render-ejs-template');

var dbhandler = require(
  process.env.APP_ROOT + '/lib/db_handler.js');

var DbFrontend = require(process.env.APP_ROOT + '/lib/create_database.js');

var Email = require(process.env.APP_ROOT + '/lib/emailSender.js');
var randtoken = require('rand-token');

var generateName = require(process.env.APP_ROOT + '/lib/generateName.js');

// setup the shared session (express + io)
require(process.env.APP_ROOT + '/lib/session.js')(app, io);

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(favicon(__dirname + '/public/media/favicon.png'));

// setup routes
require(process.env.APP_ROOT + '/lib/routes.js')(app, queue);

// start io loop
io.on('connection', function(socket) {

  console.log('new io connection to dbcloud v1');

  // setup the show_only_mine button state from session, if appropriate
  if (socket.handshake.session.show_only_mine) {
    socket.emit('set_show_only_mine', socket.handshake.session.show_only_mine);
  }

  // socket connected, authenticate it
  var username = 'unknown';
  if (typeof(socket.handshake.session.username) != 'undefined') {
    username = socket.handshake.session.username;

  } else {
    console.log('disconnecting socket, unauthorized');
    socket.disconnect('unauthorized');
    return;
  }

  // socket error handling
  socket.on('error', function(err) {
    console.log('error detected on socket: ' + err);
    return;
  });

  // ---------------------- ADMIN IO SECTION START ---------------------//

  socket.on('remove_dbserver', function(data) {
    console.log('removing dbserver: ');
    console.log(data);
    // validate admin permission
    DBServer.remove({_id: data._id}, function(err, doc) {
      if (err) {
        console.log('error: ' + err);
        return;
      }
    });
  });

  socket.on('new_dbserver_form', function() {

    var html = '<h2>New Dbserver Form</h2>';

    renderer(process.env.APP_ROOT + '/views/snipplets/new_dbserver_form.ejs',
      '',
      function(err, html) {
        if (err) {
          console.log('error rendering new_dbserver_form: ' + err);
          return;
        }
        socket.emit('display_dbserver_form', {html: html});
      });
  });

  socket.on('register_new_dbserver', function(data) {
    console.log('got new request to register the following dbserver');
    console.log(data);
    new_backend = new DBServer(data);
    new_backend.save(function(err, res) {
      if (err) {
        console.log('error? : ' + err);
        return;
      }
      console.log('new backend registered');
      console.log(res);
    });
  });

  // ---------------------- ADMIN IO SECTION END ---------------------//

  socket.on('show_portal_db_info', function(data) {
    dbhandler.getPortalConnectInfo(data.db_id, function(err, res) {
      if (err) { console.log(err); return; }
      console.log('got info: ');
      console.log(res);
    });

  });

  // this name is silly, but I need it to distinguish, will be renamed.
  // It creates a new empty database
  socket.on('just_create_new_db', function(data) {
    console.log('request to create just a new database');
    console.log(data);

    data.db_name = generateName.generateIfEmpty(data.db_name);
    data.db_username = generateName.generateIfEmpty(data.db_username);
    data.db_password = generateName.generateIfEmpty(data.db_password);

    data.username = socket.handshake.session.username;
    console.log('---> sending to logger');

    logger(socket.handshake.session.username +
    ' > creating new empty database: ' + JSON.stringify(data));

    // generate username / dbname / password if not present

    var dCI = new DbFrontend(data, function(err, res) {
      if (err) {
        console.log('error occoured: ' + err);
        Umessage.send(data.username, io, socket, 'error: ' + err,
          function(err, res) {
            if (err) {
              console.log('error sending message to frontend');
            }
          });
      }
      console.log('callback called, database created.');
    });

    // --------------- DATABASE CREATION QUEUED -------------------- //
    //
    // - Send the new row to the browsers
    dCI.on('queued', function(dbInfo) {
      console.log('+ event: job queued');

      dbhandler.newDbRow(dbInfo, function(err, html) {
        console.log('create event queued, returning rendered dbrow');
        io.emit('add_db_row', {html_data: html, username: dbInfo.username});
        //
        // disable controls
        io.sockets.emit('switch_controls', {
          id: dbInfo._id,
          is_enabled: false
        });
        Registry.findByIdAndUpdate(dbInfo._id, {
          $set: {
            'db_status_code': 'ok',
            'db_status_message': 'creating'
          }
        }, function(update_err, update_res) {
          if (update_err) { console.log(update_err); }
        });

      });

    });

    // --------------- CREATE DATABASE IN PROGRESS -------------------- //
    dCI.on('processing', function(dbInfo) {
      console.log('+ event: processing');
      Registry.findByIdAndUpdate(dbInfo._id, {
        $set: {
          'db_status_code': 'progress',
          'db_status_message': 'started working on creating this new database'
        }
      }, function(update_err, update_res) {
        if (update_err) { console.log(update_err); }
      });

    });
    // --------------- CREATE DATABASE COMPLETED -------------------- //

    dCI.on('completed', function(dbInfo) {
      logger(socket.handshake.session.username +
        ' > database created: ' + JSON.stringify(dbInfo));

      logger(socket.handshake.session.username +
        ' > new database created: ' + JSON.stringify(dbInfo));
      console.log('+ event: job completed');
      io.sockets.emit('switch_controls', {
        id: dbInfo._id,
        is_enabled: true
      });
      Registry.findByIdAndUpdate(dbInfo._id, {
        $set: {
          'db_status_code': 'ok',
          'db_status_message': 'import finished'
        }
      }, function(update_err, update_res) {
        if (update_err) { console.log(update_err); }
      });
    });

    // --------------- CREATE DATABASE FAILED -------------------- //

    dCI.on('failed', function(data) {
      logger(socket.handshake.session.username +
        ' > failed to create new database: ' + JSON.stringify(data));

      console.log('+ event: job failed');
      io.sockets.emit('switch_controls', {
        id: data.saved_db._id,
        is_enabled: false
      });

      Registry.findByIdAndUpdate(data.saved_db._id, {
        $set: {
          'db_status_code': 'error',
          'db_status_message': 'failed: ' + data.err
        }
      }, function(update_err, update_res) {
        if (update_err) { console.log(update_err); }
      });
    });
  });

  // it should provide some feedback when success (update the row 4example)
  socket.on('do_update_owner', function(data) {
    logger(socket.handshake.session.username +
      ' > updating db owner: ' + JSON.stringify(data));

    console.log('updating db: ' + data.db_id + ' to owner ' + data.owner);
    Registry.findByIdAndUpdate(data.db_id, {$set: {username: data.owner}},
      function(err, res) {
        if (err) {
          console.log('error: ' + err);
        }
      });
  });

  socket.on('get_token_list', function(data) {
    Token.find({username: socket.handshake.session.username})
      .lean()
      .exec(function(e, d) { // don't call it e and d....
      if (e) {
        console.log('err: ' + e);
        return (e);
      }
      socket.emit('display_token_list', d);
    });
  });

  socket.on('get_event_log', function(data) {
    Event.find({
      'username': socket.handshake.session.username
    }).lean().sort({_id: -1}).limit(10).exec(function(err, event_res) {
      if (err) { console.log('something wrong: ' + err);
      } else {
        new_arr = [];
        event_res.forEach(function(msg) {
          var db_date = new Date(msg.ts);
          msg.friendly_ts = moment(db_date)
            .tz('Europe/Budapest')
            .calendar();
          new_arr.push(msg);
        });
        socket.emit('display_event_log', {
          messages: new_arr
        });
      }
    });
  });

  // some basic validation would be nice...
  socket.on('set_session', function(data) {
    var session_key = data.session_key;
    var session_value = data.session_value;
    socket.handshake.session[session_key] = session_value;
  });

  socket.on('do_clone_db', function(data) {
    Umessage.send(username, io, socket, 'start database cloning',
      function(err, res) {
        if (err) {
          console.log('error sending message to frontend');
        }
      });
    // too many parameteres. fix it.
    logger(socket.handshake.session.username +
      ' > start cloning database, given data: ' + JSON.stringify(data));

    clone_db(data, io, socket, username,
      queue, function(err, res) {
        if (err) {

          logger(socket.handshake.session.username +
            ' > error in database clone: ' + JSON.stringify(err) +
            ', know data: ' + JSON.stringify(res));

          Umessage.send(username, io, socket, 'cloning failed: ' + err,
            function(err, res) {
              if (err) {
                console.log('error sending message to frontend');
              }
            });
          console.log('clone failed: ' + err);
        } else {
          logger(socket.handshake.session.username +
            ' > clone finished: ' + JSON.stringify(res));
          Umessage.send(username, io, socket, 'cloning finished',
            function(err, res) {
              if (err) {
                console.log('error sending message to frontend');
              }
            });
          console.log(' -------- results from clone operation -------------');
          console.log(res._id);
          if (data.request_email === true) {
            dbhandler.getPortalConnectInfo(res._id, function(err, res) {
              if (err) { console.log(err); return; }
              console.log('got info: ');
              console.log(res);
              console.log(data);
              console.log('sending email to ' + username);
              console.log('no, not sending email, it has to be upgraded');
              // Email.send({
              //   to: username + '@example.com',
              //   from: '@example.com',
              //   subject: 'Your database import is now completed',
              //   html: res
              // });
            });
          } else {
            console.log('not sending email');
          }
        }
      });
  });

  socket.on('remove_db', function(data) {

    // send a message: persist it into the database and notify the client
    logger(socket.handshake.session.username +
    ' > start removing database: ' + JSON.stringify(data));
    Umessage.send(username, io, socket, 'start removing database',
      function(err, res) {
        if (err) {
          console.log('error sending message to frontend');
        }
      });

    remove_db(data, io, socket, username, queue,
      function(err, res) {

        if (err) {
          logger(socket.handshake.session.username +
          ' > error removing database: ' + err);

          Umessage.send(username, io, socket,
            'error removing database: ' + err,
            function(err, res) {
              if (err) {
                // !!! error handling
                console.log('error sending message to frontend');
              }
            });

        } else {
          logger(socket.handshake.session.username +
          ' > removed database: ' + JSON.stringify(res));
          Umessage.send(username, io, socket, 'finished removing database',
            function(err, res) {
              if (err) {
                // !!! error handling
                console.log('error sending message to frontend: ' + err);
              }
            });
        }
      });
  });

  socket.on('get_db_list', function(data) {
    var query = {};
    auth.isAdmin(socket.handshake.session.username, function(err, isAdmin) {
      if (err) {
        console.log('error while checking admin flag: ' + error);
        return;
      }
      if (isAdmin == 1) {
        query = {};
      } else {
        query = {$or:
          [
            {private: {$exists: false}},
            {username: socket.handshake.session.username}
        ]};
      }
      Registry.find(query).lean().exec(function(err, res) {
        if (err) {
          console.log('err:' + err);
          socket.emit('notification',
            {msg: 'failed to look up local db list (or just empty): ' + err});
        } else {
          var json_data = {
            dbrows: res,
            filename: process.env.APP_ROOT + '/views/snipplets/dblist.ejs',
            username: username,
            session: socket.handshake.session
          };

          renderEjsTemplate(
            json_data.filename,
            json_data,
            function(err, html_dbs) {
              if (err) {
                console.log('error happened');
                // TODO send it to the logger
              } else {
                socket.emit('update_dblist',{html_data: html_dbs});
              }
            });
        }
      });

    });
  });

  // request importing a file into a created database
  socket.on('request_import', function(data) {

    logger(socket.handshake.session.username +
    ' > requesting database import: ' + JSON.stringify(data));

    Umessage.send(username, io, socket, 'starting database import',
      function(err, res) {
        if (err) {
          // TODO need a proper way to handle those kind of errors
          console.log('error sending message to frontend');
        }
      });
    console.log('calling import_db.import with ' + username);
    var import_process = new import_db.import(
      data, io, socket, username, queue, function(err, res) {

        if (err) {

          logger(socket.handshake.session.username +
          ' > import failed ' + err);

          console.log('import FAILED');
          console.log('returned something: ');
          console.log(res);

          io.sockets.emit('update_db_row_status', {
            db_id: res._id,
            msg: 'import failed, this entry is no longer valid and will ' +
            'disappear in the next page reload (rollback)'
          });

          io.sockets.emit('switch_controls', {
            id: res._id,
            is_enabled: false
          });

          io.sockets.emit('set_row_status', {
            id: res._id,
            desired_class: 'status_error'
          });

          Umessage.send(username, io, socket, 'database import failed: ' + err,
            function(err, res) {
              if (err) {
                console.log('error sending message to frontend');
              }
            });

        } else {

          logger(socket.handshake.session.username +
          ' > import finished ' + JSON.stringify(res));

          console.log('it seems the import is just fine'); // no, not always.
          // throw(new Error().stack);
          console.log(res);
          Umessage.send(username, io, socket, 'database import success',
          function(err, res) {
            if (err) {
              console.log('error sending message to frontend');
            }
          });
          console.log('got data from import');
          console.log(res);
          if (data.request_email === true) {
            dbhandler.getPortalConnectInfo(res._id, function(err, res) {
              if (err) { console.log(err); return; }
              console.log('got info: ');
              console.log(res);
              console.log(data);
              console.log('not sending (disabled) email to ' + username);
              Email.send({
                to: username + '@exapmle.com',
                from: 'example@example.com',
                subject: 'Your database import is now completed',
                html: res
              });
            });
          } else {
            console.log('not sending email');
          }
        }
      });

    // ------------------- IMPORT JOB QUEUED --------------------- //
    import_process.on('queued', function(data) {
      console.log('++ EVENT: queued');
      console.log(data);

    });

    // ------------------- IMPORT JOB PROCESSING --------------------- //
    import_process.on('processing', function() {
      console.log('++ EVENT: processing');
    });

    // ------------------- IMPORT JOB COMPLETE --------------------- //
    import_process.on('complete', function(db_data) {
      console.log('++ EVENT: complete');
      io.sockets.emit('update_db_row_status', {
        db_id: db_data._id,
        msg: 'import finished, re-enabling controls'
      });

      Registry.findByIdAndUpdate(db_data._id, {
        $set: {
          'db_status_code': 'ok',
          'db_status_message': 'import finished'
        }
      }, function(update_err, update_res) {
        if (update_err) {
          console.log('error updating db record: ' + update_err);
          return;
        }
      });

      io.sockets.emit('switch_controls', {
        id: db_data._id,
        is_enabled: true
      });
    });

    // ------------------- IMPORT JOB FAILED --------------------- //
    import_process.on('failed', function(err, db_data) {
      console.log('There is an error: ' + err);
      // MARK: BUG, doesn't return the underlying error
      io.sockets.emit('switch_controls', {
        id: db_data._id,
        is_enabled: false
      });
      Umessage.send(username, io, socket, 'database import failed: ' +
        err + ' == rolling back ==',
        function(err, res) {
          if (err) {
            console.log('error sending message to frontend');
          }
        });

      Registry.findByIdAndUpdate(db_data._id, {
        $set: {
          'db_status_code': 'error',
          'db_status_message': 'import failed: ' + err
        }
      }, function(update_err, update_res) {
        console.log('update db_status_code: ' + update_err);
        return;
      });

    });

    // ------------------- IMPORT JOB ERROR --------------------- //
    import_process.on('error', function(err) {
      console.log('++ EVENT: error');
      console.log(err);
      return;
    });
  });

  // client asked to extend the database expirity with 30 days
  socket.on('extend_30days', function(data) {

    Registry.findById(data.db_id, function(err, res) {

      logger(socket.handshake.session.username +
      ' > extending database expirity with 30days: ' + res);

      if (err) {
        console.log('failed to findOne by the current db id: ' + data.db_id);
      }
      var nDate = new Date(res.expires);
      nDate.setDate(nDate.getDate() + 30);
      var new_expire = nDate.toISOString().substr(0,10);

      Registry.findByIdAndUpdate(data.db_id, {
        $set: {'expires': new_expire}}, function(err, res) {
          if (err) {
            console.log('error while extending expirity');
          }
        });
    });
  });

  // client asked for the file list
  socket.on('show_file_list', function(data) {
    var username = socket.handshake.session.username;
    show_file_list(data, io, socket, username, queue);
  });

  // purge the record about a database (for example if it cannot be removed)
  socket.on('purge_db_record', function(data) {
    var db_id = data.db_id;

    logger(socket.handshake.session.username +
    ' > purging database record (from registry): ' + data);

    Registry.remove({'_id': data.db_id}, function(err, res) {
      if (err) {
        io.sockets.emit('update_db_row', {
          action: 'finish_remove',
          db_id: db_data.db_id
        });
      }
    });
  });
  socket.on('request_token', function(data) {
    var username = socket.handshake.session.username;
    console.log('new token request from ' + username);
    var new_token = new Token({
      token_id: randtoken.generate(16),
      username: socket.handshake.session.username
    });
    new_token.save(function(err) {
      if (err) {
        console.log('error saving token: ' + err);
        return (err);
      }
      socket.emit('display_token', new_token);
    });
  });
  socket.on('install_sample_dbservers', function(data) {
    console.log('installing sample dbservers');
    // hardcoded. its a sample.
    var newServer = new DBServer({
           "name" : "mysql_55",
                "version" : "5.5",
                "host" : "172.17.0.1",
                "port" : "32778",
                "friendlyname" : "MySQL 5.5",
                "provider" : "mysql",
                "admin_username" : "root",
                "admin_password" : process.env.SAMPLE_PASSWORD,
                "password" : process.env.SAMPLE_PASSWORD
    });
    newServer.save(function(err, dt) {
      console.log('saved');
    });
    var newServer2 = new DBServer({
           "name" : "mysql_56",
                "version" : "5.5",
                "host" : "172.17.0.1",
                "port" : "32779",
                "friendlyname" : "MySQL 5.6",
                "provider" : "mysql",
                "admin_username" : "root",
                "admin_password" : process.env.SAMPLE_PASSWORD,
                "password" : process.env.SAMPLE_PASSWORD
    });
    newServer2.save(function(err, dt) {
      console.log('saved');
    });
    var newServer3 = new DBServer({
           "name" : "mysql_57",
                "version" : "5.7",
                "host" : "172.17.0.1",
                "port" : "32780",
                "friendlyname" : "MySQL 5.7",
                "provider" : "mysql",
                "admin_username" : "root",
                "admin_password" : process.env.SAMPLE_PASSWORD,
                "password" : process.env.SAMPLE_PASSWORD
    });
    newServer3.save(function(err, dt) {
      console.log('saved');
    });

  });
});

server.listen(8080);
console.log('listening on 8080 (which is exposed to ' + EXPOSED_PORT + ')');

logger(' > starting server at 8080');

