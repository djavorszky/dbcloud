var REDIS_HOST = process.env.REDIS_HOST;
var REDIS_PORT = process.env.REDIS_PORT;
var BASE_DIR = process.env.BASE_DIR;
var EXPOSED_PORT = process.env.EXPOSED_PORT;
var SESSION_SECRET = process.env.SESSION_SECRET;
var APP_ROOT = process.env.APP_ROOT;

var generate = require(process.env.APP_ROOT + '/lib/generateName.js');
var async = require('async');
var containerStatus = require(process.env.APP_ROOT + '/lib/containerStatus.js');
var xssFilter = require('xss-filters');
var fs = require('fs');

var EventEmitter = require('events').EventEmitter;
var util = require('util');

var renderEjsTemplate = require(
  process.env.APP_ROOT + '/lib/renderEjsTemplate.js');

var Registry = require(process.env.APP_ROOT + '/lib/db_registry.js').registry;
var dbhandler = require(process.env.APP_ROOT + '/lib/db_handler.js');
var CreateDB = require(
  process.env.APP_ROOT + '/lib/create_database.js');

var request_import = (function(
      data,
      io,
      socket,
      username,
      queue,
      import_callback) {

  var me = this;

  process.nextTick(function() {

    // generate db credentials
    var db_data = {};

    var expire_date = new Date();
    expire_date.setDate(expire_date.getDate() + 30);
    db_data.expires = expire_date.toISOString().substr(0,10);

    db_data.db_name = generate.generateIfEmpty(data.dbname);
    db_data.db_username = generate.generateIfEmpty(data.username);
    db_data.db_password = generate.generateIfEmpty(data.password);
    db_data.db_server = data.db_server;
    db_data.import_file = data.import_file;
    db_data.username = username;

    async.waterfall([
      // ---------------- GET BACKEND INFORMATION ------------------ //
      function(cb) { // connect to database server
        dbhandler.getDatabaseServer(data.db_server, function(err, dbServer) {
          if (err) {
            return cb(err);
          }

          db_data.db_port = dbServer.port;
          db_data.db_host = dbServer.host;

          console.log('setting up dbserver: ' +
            db_data.host +
            ':' + db_data.db_port);

          cb(null, db_data);
        });

      // ---------------- CREATE THE DATABASE ------------------ //
      }, function(db_data, cb) {
        dbhandler.validateDatabaseConnectInfo(
        db_data.db_name, db_data.db_username,
        function(err) {
          if (err) { return cb(err, db_data); }
          cb(null, db_data);
        });

      }, function(db_data, cb) {
        var myNewDB = new CreateDB(db_data, function(err, savedDB) {
          if (err) {
            console.log('===== ROLLBACK ====');
            console.log(savedDB);
            console.log('processing rollback for: ' + savedDB._id);
            Registry.remove({_id: savedDB._id}, function(rm_err, res) {
              if (rm_err) {
                console.log('rollback error: removing failed record');
                return cb('rollback error while removing failed record; ' +
                  err);
              }
              return cb('rollback completed: ' + err, db_data);
            });

          } else {
            io.sockets.emit('update_db_row_status', {
              db_id: savedDB._id,
              msg: 'privileges granted'
            });

            cb(null, savedDB);
          }
        });

      // --------- CREATE THE IMPORT COMMAND AND EXECUTE IT ----- //
      }, function(db_data, cb) {
        var json_data = {
          'dbrow': db_data,
          'filename': APP_ROOT + '/views/snipplets/dblist_row.ejs',
          'username': username,
          'session': socket.handshake.session
        };
        console.log(json_data);
        renderEjsTemplate(
            json_data.filename,
            json_data,
            function(err, res) {
            if (err) {
              console.log('failed to open ejs template for dblist: ' + err);
              return cb(err);
            } else {
              io.sockets.emit('add_db_row',{
                html_data: res, username: username});

              io.sockets.emit('switch_controls', {
                id: db_data._id,
                is_enabled: false
              });

              Registry.findByIdAndUpdate(db_data._id, {
                $set: {
                  'db_status_code': 'progress',
                  'db_status_message': 'importing from' + db_data.import_file
                }
              }, function(update_err, update_res) {
                if (err) {
                  console.log('error updating import progress: ' + update_err);
                  return cb(update_err, db_data);
                }
                cb(null, db_data);
              });
            }
          });
      }, function(db_data, cb) {
        io.sockets.emit('update_db_row_status', {
          db_id: db_data._id,
          msg: 'importing ' + db_data.import_file});

        // get the command which is needed to read the file

        // TODO It's not so smart including it every time.

        var getFileCommand = require(process.env.APP_ROOT +
            '/lib/format_handler')(db_data.import_file);

        if (getFileCommand[0] !== null) {
          return cb('error in import while guessing file reader command: ' +
            getFileCommand[0]);
        }

        // ---------------- DO THE IMPORTING ------------------ //
        var db_import_command = getFileCommand[1] + ' ' + db_data.import_file +
        ' | sed \'s/^CREATE DATABASE.*//\' | sed \'s/^USE .*//g\' | mysql -u' +
        db_data.db_username + ' -p' +
        db_data.db_password + ' -P ' +
        db_data.db_port + ' -h ' + db_data.db_host + ' ' + db_data.db_name;

        var db_import_job = queue.create('db_operation', db_import_command)
          .save(function(err) {
          if (err) {
            console.log('error creating import job');
            return cb(err);
          } else {
            me.emit('queued', db_data);
          }
        });
        db_import_job.on('progress', function(dbInfo) {
          me.emit('processing');
        });

        // ------- IMPORT JOB COMPLETED ------- //
        db_import_job.on('complete', function(result) {
          console.log('returning success from import_job');
          me.emit('complete', db_data);
          console.log('emitting complete');
          cb(null, db_data);
        });

        // ------- IMPORT JOB FAILED ------- //
        db_import_job.on('failed', function(err) {
          me.emit('failed', err, db_data);
          // rollback; remove database from the registry

          console.log('===== ROLLBACK ====');
          Registry.remove({_id: db_data._id}, function(remove_err, res) {
            if (remove_err) {
              console.log('rollback error: removing failed record');
              return cb('rollback error while removing failed record',
                db_data);
            }
            return cb('rollback triggered by: ' + err, db_data);
          });
        });
      }
    ], function(err, result) {
      if (err) {
        console.log('error in import job: ' + err);
        return import_callback(err, result);
      } else {
        import_callback(null, result);
      }
    });
  });
});

util.inherits(request_import, EventEmitter);

module.exports.import = request_import;

