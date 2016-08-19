var dbhandler = require(process.env.APP_ROOT + '/lib/db_handler.js');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var kue = require('kue');
var queue = kue.createQueue({redis: {host: process.env.REDIS_HOST}});

var async = require('async');

//  ---- dbInfo ----
// { db_username: 'ueue',
//   db_password: 'eue',
//   db_name: 'ueueu',
//   request_email: false,
//   db_server: 'mysql_55',
//   username: 'gyula.weber' }

var createDatabase = function(dbInfo, cb) {
  console.log(' ---- dbInfo ---- ');
  console.log(dbInfo);
  var me = this;
  this.on('newListener', function(listener) {
    console.log('(create database) new Event Listener: ' + listener);
  });
  dbhandler.validateDatabaseConnectInfo(
  dbInfo.db_username,
  dbInfo.db_name,
  function(err, validate_res) {
    if (err) {
      return cb(err, validate_res);
    }
    dbhandler.getDatabaseServer(dbInfo.db_server,
    function(err, serverInfo) {
      if (err) {
        return cb(err);
      }

      // get the database connect string
      dbhandler.getDatabaseConnectString(serverInfo,
      function(err, connect_string) {
        if (err) { return cb(err); }
        dbhandler.registerDatabase(dbInfo, serverInfo,
        function(err, saved_db) {

          if (err) { return cb(err); }
          console.log('got connect string: ' + connect_string);
          dbhandler.createMysqlCommand(connect_string,
            'create database ' + dbInfo.db_name,
            function(err, cmd) {
              if (err) { return cb(err, saved_db); }
              console.log('got command: ' + cmd);
              console.log('dispatching job');
              var new_db_job = queue.create(
                'db_operation', cmd).save(
                  function(err) {
                    if (err) { return cb(err, saved_db); }
                    me.emit('queued', saved_db);
                  });

              // proxy kue events to the function event handler
              new_db_job.on('complete', function(result) {
                dbhandler.grantDatabasePermissions(dbInfo, function(err, cret) {
                  if (err) { return cb(err, saved_db); }
                  console.log('permissions granted');
                  me.emit('completed', saved_db);
                  cb(null, saved_db);
                });
              });

              new_db_job.on('failed', function(err) {
                me.emit('failed', {saved_db: saved_db, err: err});
                return cb(err, saved_db);
              });

              new_db_job.on('progress', function(data) {
                me.emit('processing', saved_db);
              });
            });
        });
      });
    });

  });

};
util.inherits(createDatabase, EventEmitter);

module.exports = createDatabase;
