var async = require('async');
var fs = require('fs');
var xssFilter = require('xss-filters');
var renderEjsTemplate = require(APP_ROOT + '/lib/renderEjsTemplate.js');
var Registry = require(APP_ROOT + '/lib/db_registry.js').registry;
var generate = require(APP_ROOT + '/lib/generateName.js');
var dbhandler = require(process.env.APP_ROOT + '/lib/db_handler.js');
var CreateDB = require(process.env.APP_ROOT + '/lib/create_database.js');

var clone_db = (function(
      data,
      io,
      socket,
      username,
      queue,
      clone_callback) {
  var db_id = data.src_db_id;
  async.waterfall([

    // get the source database info
    function(cb) {
      data.dst_db_name = generate.generateIfEmpty(data.dst_db_name);
      data.dst_db_username = generate.generateIfEmpty(data.dst_db_username);
      data.dst_db_password = generate.generateIfEmpty(data.dst_db_password);
      cb(null, db_id);

    }, function(db_id, cb) {
      Registry.findOne({'_id': db_id}, function(err, res) {
        if (err) {
          return cb(err, res);
        } else {

          // lookup db port
          dbhandler.getDatabaseServer(data.dst_db_type, function(e, dbserver) {
            data.dst_db_host = dbserver.host;
            data.dst_db_port = dbserver.port;
            data.dst_db_admin_username = dbserver.admin_username;
            data.dst_db_admin_password = dbserver.admin_password;

            var dst_db_data = {
              'admin_username': dbserver.admin_username,
              'admin_password': dbserver.admin_password,
              'db_name': xssFilter.inHTMLData(data.dst_db_name),
              'db_username': xssFilter.inHTMLData(data.dst_db_username),
              'db_password': xssFilter.inHTMLData(data.dst_db_password),
              'db_server': xssFilter.inHTMLData(data.dst_db_type),
              'username': xssFilter.inHTMLData(username),
              'expires': xssFilter.inHTMLData(res.expires),
              'db_port': xssFilter.inHTMLData(data.dst_db_port),
              'db_host': xssFilter.inHTMLData(data.dst_db_host),
              'import_file': xssFilter.inHTMLData(res.import_file) +
                ' (clone of ' + res.db_name + ')',
              'src_db': res
            };
            var myNewDbServer = new CreateDB(dst_db_data, function(err, ndb) {
              if (err) { return cb(err, ndb); }
              dst_db_data._id = ndb._id;
              cb(null, res, dst_db_data);
            });
          });
        }
      });

    }, function(src_db, dst_db, cb) {
      dbhandler.getDatabaseServer(src_db.db_server, function(err, serverInfo) {
        if (err) { return cb(err); }
        src_db.host = serverInfo.host;
        src_db.port = serverInfo.port;
        src_db.admin_username = serverInfo.admin_username;
        src_db.admin_password = serverInfo.admin_password;

        cb(null, src_db, dst_db);
      });
    }, function(src_db, dst_db, cb) {
      var json_data = {
        'default_host': dst_db.db_host,
        'dbrow': dst_db,
        'filename': APP_ROOT + '/views/snipplets/dblist_row.ejs',
        'username': username,
        'session': socket.handshake.session
      };
      renderEjsTemplate(json_data.filename, json_data, function(err, res) {
        if (err) {
          console.log('error: ' + err);
          return cb(err, dst_db._id);
        } else {
          io.sockets.emit('add_db_row',{
            html_data: res, username: username
          });

          cb(null, src_db, dst_db);
        }
      });
    }, function(src_db, dst_db, cb) {
      // lock the source row
      io.sockets.emit('switch_controls', {
        id: src_db._id,
        is_enabled: false
      });
      io.sockets.emit('update_db_row_status', {
        db_id: src_db._id,
        msg: 'Disabling controls because I\'m a donor for a clone'});

      Registry.findByIdAndUpdate(src_db._id, {
        $set: {
          'db_status_code': 'progress',
          'db_status_message': 'cloning to: ' + dst_db.db_name
        }
      }, function(update_err, update_res) {
      });

      // lock the destination
      io.sockets.emit('switch_controls', {
        id: dst_db._id,
        is_enabled: false
      });
      io.sockets.emit('update_db_row_status', {
        db_id: dst_db._id,
        msg: 'Cloning is just started'});

      Registry.findByIdAndUpdate(dst_db._id, {
        $set: {
          'db_status_code': 'progress',
          'db_status_message': 'cloning from: ' + src_db.db_name
        }
      }, function(update_err, update_res) {
        if (update_err) {
          console.log('error updating database clone status: ' + update_err);
        }
      });

      cb(null, src_db, dst_db);

    }, function(src_db, dst_db, cb) {
      console.log('creating clone command');
      var clone_db_command = 'mysqldump -u root -h ' +
        src_db.host + ' -u' +
        src_db.db_username + ' -p' +
        src_db.db_password + ' -P ' +
        src_db.db_port + ' ' + src_db.db_name;

      clone_db_command += ' | mysql -u' +
        dst_db.db_username + ' -p' +
        dst_db.db_password + ' -h ' +
        dst_db.db_host + ' -P ' +
        dst_db.db_port + ' ' + dst_db.db_name;

      var t_clone_db_job = queue.create(
          'db_operation', clone_db_command).save(function(err) {
        if (err) {

          console.log('error saving job: ' + err);
          return cb(err, dst_db._id);
        } else {
          cb(null, t_clone_db_job, src_db, dst_db);
        }
      });

    }, function(t_clone_db_job, src_db, dst_db, cb) {
      t_clone_db_job.on('complete', function(result) {

        // re-enable dst db controls
        console.log('------------ MOOOOOOOOOOOOOOOOO ---------------- ');
        console.log(dst_db);
        io.sockets.emit('switch_controls', {
          id: dst_db._id,
          is_enabled: true
        });

        io.sockets.emit('update_db_row_status', {
          db_id: dst_db._id,
          msg: 'Cloning finished, Thanks for your patience.'});

        Registry.findByIdAndUpdate(src_db._id, {
          $set: {
            'db_status_code': 'ok',
            'db_status_message': 'cloning completed to: ' + dst_db.db_name
          }
        }, function(update_err, update_res) {
        });
        Registry.findByIdAndUpdate(dst_db, {
          $set: {
            'db_status_code': 'ok',
            'db_status_message': 'cloning completed from: ' + src_db.db_name
          }
        }, function(update_err, update_res) {
        });

        // re-enable src db controls
        io.sockets.emit('switch_controls', {
          id: src_db._id,
          is_enabled: true
        });
        io.sockets.emit('update_db_row_status', {
          db_id: src_db._id,
          msg: 'Cloning finished, lock released (I was the donor)'});
        io.sockets.emit('new_db_row');
        console.log('clone completed, emitting callback');
        cb(null, dst_db);
      });

      t_clone_db_job.on('failed', function(err, res) {
        console.log('job event: clone db command failed: ' + err);
        // re-enable dst db controls
        io.sockets.emit('switch_controls', {
          id: dst_db._id,
          is_enabled: true
        });
        io.sockets.emit('update_db_row_status', {
          db_id: dst_db._id,
          msg: 'Cloning finished with an error :( ' + err
        });
        // set the error on the row
        io.sockets.emit('set_row_status', {
          id: dst_db._id,
          desired_class: 'status_error'
        });

        // re-enable src db controls
        io.sockets.emit('switch_controls', {
          id: src_db._id,
          is_enabled: true
        });

        io.sockets.emit('update_db_row_status', {
          db_id: src_db._id,
          msg: 'Cloning failed, lock released (I was the donor)'});

        Registry.findByIdAndUpdate(src_db._id, {
          $set: {
            'db_status_code': 'ok',
            'db_status_message': 'cloning failed to: ' + dst_db.db_name +
            ', but it dont affect me'
          }
        }, function(update_err, update_res) {
        });
        Registry.findByIdAndUpdate(dst_db._id, {
          $set: {
            'db_status_code': 'error',
            'db_status_message': 'cloning failed from: ' + src_db.db_name +
            ' because: ' + err
          }
        }, function(update_err, update_res) {
          if (update_err) { return cb(err); }
        });
        return cb(err);
      });
    }
  ], function(err, res) {
    if (err) {
      console.log('clone failed: ' + err + ', res: ' + res);

      if (db_id) {
        io.sockets.emit('update_db_row_status', {
          db_id: res,
          msg: 'Cloning failed: ' + err});

        Registry.findByIdAndUpdate(res, {
          $set: {
            'db_status_code': 'error',
            'db_status_message': 'clone failed: ' + err
          }
        }, function(update_err, update_res) {
        });
      }
      io.sockets.emit('set_row_status', {
        id: res,
        desired_class: 'status_error'
      });

      return clone_callback(err, res);

    } else {
      console.log('firing callback ::: clone_callback');
      clone_callback(null, res);
    }
  });
});

module.exports = clone_db;
