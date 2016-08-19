var async = require('async');
var mysql = require('mysql');
var fs = require('fs');
var projectname = require('project-name-generator');
var xssFilter = require('xss-filters');
var ejs = require('ejs');
var Registry = require(APP_ROOT + '/lib/db_registry.js').registry;
var DBServer = require(APP_ROOT + '/lib/db_handler.js').dbservers;

var dbhandler = require(process.env.APP_ROOT + '/lib/db_handler.js');

// workaround to avoid writing a waterfall

var remove_db = (function(
      data, io, socket, username, queue, remove_cb) {
  var progress_item = data.db_id;
  var db_id = data.db_id;

  io.sockets.emit('switch_controls', {
    is_enabled: false,
    id: db_id
  });

  Registry.findByIdAndUpdate(db_id, {
    $set: {
      'db_status_code': 'progress',
      'db_status_message': 'removing database: ' + db_id
    }
  }, function(update_err, update_res) {
  });

  // tell the client to mark this row as being removed
  io.sockets.emit('update_db_row', {
    action: 'start_remove',
    db_id: db_id
  });

  Registry.findById(db_id, function(err, res) {
    var databaseInfo = res;
    if (err) {
      console.log('error on socket.on(remove_db) while finding ID: ' +
        err);
      return remove_cb(err);
    }

    // get the server info

    dbhandler.getDatabaseServer(res.db_server, function(err, dbsrv) {
      if (err) {
        return remove_cb(err, databaseInfo);
      }

      var remove_db_command = 'mysql -u' +
        dbsrv.admin_username +
        ' -p' + dbsrv.admin_password + ' -h ' +
        dbsrv.host + ' -P ' + res.db_port + ' -e \'drop database ' +
        res.db_name + '\'';

      // create a job which will remove the database
      // (the actual process is defined in lib/queue)
      var remove_job = queue.create('db_operation',
          remove_db_command).save(function(err) {
            if (err) {
              console.log('error saving job: ' + err);
              return remove_cb('error creating job: ' + err, databaseInfo);
            }
          });

      // the queue will send us a complete event, when its done
      remove_job.on('complete', function(result) {
        Registry.remove({'_id': db_id}, function(err, res) {
          if (err) {
            console.log('error while removing db: ' + err);
            io.sockets.emit('update_db_row', {
              action: 'error_remove',
              db_id: db_id
            });
            return remove_cb(err, databaseInfo);

          } else {
            io.sockets.emit('update_db_row', {
              action: 'finish_remove',
              db_id: db_id
            });
            remove_cb(null, databaseInfo);
          }
        });
      });

      // the queue will send us a failed event, when something went wrong
      remove_job.on('failed', function(err) {
        console.log('db removal job sent error signal: ' + err);
        io.sockets.emit('update_db_row', {
          action: 'error_remove',
          db_id: db_id,
          msg: err
        });

        Registry.findByIdAndUpdate(db_id, {
          $set: {
            'db_status_code': 'error',
            'db_status_message': 'Error while trying to remove database: ' + err
          }
        }, function(update_err, update_res) {
          return remove_cb(err); // module callback, failed
        });
        console.log('error: ' + err);
      });
    });
  });
});

module.exports = remove_db;
