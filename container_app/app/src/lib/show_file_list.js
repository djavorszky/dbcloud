// environmental variables (they are in the docker-compose* files)

var REDIS_HOST = process.env.REDIS_HOST;
var REDIS_PORT = process.env.REDIS_PORT;
var BASE_DIR = process.env.BASE_DIR;
var EXPOSED_PORT = process.env.EXPOSED_PORT;
var SESSION_SECRET = process.env.SESSION_SECRET;
var APP_ROOT = process.env.APP_ROOT;

var async = require('async');
var mysql = require('mysql');
var fs = require('fs');
var projectname = require('project-name-generator');
var xssFilter = require('xss-filters');
var ejs = require('ejs');
var bytes = require('bytes');

var getFileReadCommand = require(process.env.APP_ROOT +
    '/lib/format_handler.js');

var DBServer = require(process.env.APP_ROOT + '/lib/db_registry.js').dbservers;

function isFile(o) {
  return o.type === 'file';
}
function isDirectory(o) {
  return o.type === 'directory';
}

var show_file_list = (function(
      data, io, socket, username, queue) {
  current_directory = BASE_DIR;

  // if we put BASE_DIR into the current_directory,
  // it will use the base directory.
  if (data.current_directory != 'BASE_DIR') {
    current_directory = data.current_directory;
  }

  // no parameter, its the root directory
  var contents = fs.readdirSync(current_directory);
  var file_list = [];

  // it will run a sequence:
  // - get a directory list
  // - iterate through them
  //   - call stat on each
  //   - put the data into the array of objects
  // - load the html template file
  // - call ejs with the template file + values to render the final html
  // - send the generated html file to the clients via websocket

  async.waterfall([
      function(cb) {
        for (var i = 0; i < contents.length; i++) {
          file_list.push({name: contents[i]});
        }
        cb(null, file_list);
      },
      function(file_list, cb) {
        var info = [];
        async.forEachOf(file_list, function(el, idx, callback) {
          fs.stat(current_directory + '/' + el.name, function(err, stat) {
            if (err) {
              return callback(err);
            }
            var entry_type = '';
            var is_dbdump = 0;
            if (stat.isFile()) {
              entry_type = 'file';

              var getterCommand = getFileReadCommand(el.name);
              if (getterCommand[0] === null) {
                is_dbdump = 1;
              } else {
                is_dbdump = 0;
              }

              // console.log('err: ' + getterCommand[0]); // error-first return
              // console.log('cmd: ' + getterCommand[1]);
            } else {
              entry_type = 'directory';
            }

            info.push({
              name: el.name,
              type: entry_type,
              size: stat.size,
              size_string: bytes(stat.size),
              current_directory: current_directory,
              is_dbdump: is_dbdump});
            callback(null, info);
          });
        }, function(err) {
          if (err) {
            console.log('asyncforeach error happened: ' + err);
            cb(err);
          } else {
            cb(null, info);
          }
        });
      }
  ], function(err, res) {
    if (err) {
      console.log('error in the file list: ' + err);
    } else {
      var file_list = res.filter(isFile);
      var dir_list = res.filter(isDirectory);

      var sorted_directories = dir_list.sort(function(a, b) {
        if (a.name < b.name) {
          return -1;
        } else if (a.name > b.name) {
          return 1;
        } else {
          return 0;
        }
      });

      var sorted_files = file_list.sort(function(a, b) {
        if (a.name < b.name) {
          return -1;
        } else if (a.name > b.name) {
          return 1;
        } else {
          return 0;
        }
      });

      DBServer.find().lean().exec(function(err, serverList) {
        sorted_list = sorted_directories.concat(sorted_files);
        fs.readFile('views/snipplets/filelist.ejs', function(err, data) {
          var html_file_list = ejs.render(data.toString(), {
            files: sorted_list,
            current_directory: current_directory,
            BASE_DIR: BASE_DIR,
            dbs: serverList
          });
          socket.emit('display_files', {html_data: html_file_list});
        });

      });
    }
  });
});

module.exports = show_file_list;
