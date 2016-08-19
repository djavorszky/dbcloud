// responsibility: provide an abstraction for database operations

// queue handling
var kue = require('kue');
var queue = kue.createQueue({redis: {host: process.env.REDIS_HOST}});

// database schema
var Registry = require(process.env.APP_ROOT + '/lib/db_registry.js').registry;
var DBServers = require(process.env.APP_ROOT + '/lib/db_registry.js').dbservers;
var renderEjsTemplate = require('render-ejs-template');

// core modules
var fs = require('fs');

var getDatabaseById = (function(db_id, cb) {
  Registry.findById(db_id, function(err, doc) {
    if (err) { return cb(err); }
    cb(null, doc);
  });
});

var getDatabaseByName = (function(db_name, cb) {
  Registry.find({db_name: db_name}).lean().exec(function(err, docs) {
    if (err) { return cb(err); }
    var doc = docs[0];
    cb(null, doc);
  });
});

// check if the database username is available
var validateDatabaseUsername = (function(username, cb) {
  if (username.toUpperCase() == 'ROOT') {
    return cb('root username is reserved for ... guess who... root :)');
  }

  if (username.toUpperCase() == 'MYSQL') {
    return cb('mysql username is reserved');
  }

  Registry.findOne({db_username: username}, function(err, res) {
    if (err) {
      return cb(err);
    }
    console.log(res);
    if (res) {
      console.log('this username is already taken');
      return cb('the username: ' + username +
        ' is already taken, please chose a different one');
    } else {
      return cb(null);
    }
  });
});

// check if the database name is available
var validateDatabaseName = (function(db_name, cb) {
  if (db_name.toUpperCase() == 'ROOT') {
    return cb('root username is reserved');
  }

  if (db_name.toUpperCase() == 'MYSQL') {
    console.log('mysql database name is reserved');
    return cb('mysql database name is reserved');
  }

  Registry.findOne({db_name: db_name.toLowerCase()}, function(err, res) {
    if (!res) {
      return cb(null, true); // no result, so it's not used anywhere else
    }
    if (err) {
      console.log('error: ' + err);
      return cb(err);
    }
    if (res) {
      console.log('this database name is already taken');
      return cb('the database name: ' + db_name +
        ' is already taken, please chose a different one', db_name);
    }
  });
});

// grant permissions based on the dbInfo
var grantDatabasePermissions = (function(dbInfo, cb) {
  getDatabaseServer(dbInfo.db_server, function(err, serverInfo) {
    if (err) { return cb(err); }

    dbInfo.db_port = serverInfo.port;
    dbInfo.db_host = serverInfo.host;

    getDatabaseConnectString(serverInfo, function(err, connect_string) {
      if (err) { return cb(err); }
      var grant_query = 'grant all privileges on ' +
        dbInfo.db_name +
        '.*' +
        ' to "' +
        dbInfo.db_username +
        '"@' +
        '"%"' +
        ' identified by ' +
        '"' + dbInfo.db_password + '"';

      createMysqlCommand(connect_string, grant_query,
        function(err, cmd) {
          console.log('generated grant cmd: ' + cmd);
          var grant_job = queue.create('db_operation', cmd)
            .save(function(err) {
              if (err) { return cb(err); }
            });

          grant_job.on('failed', function(err) {
            if (err) { return cb(err); }
          });

          grant_job.on('complete', function(data) {
            cb(null);
          });

        });
    });
  });
});

// check if the database name and the username is available
var validateDatabaseConnectInfo = (function(db_name, username, cb) {
  console.log('validating db name: ' + db_name);
  console.log('validating username: ' + username);
  validateDatabaseName(db_name, function(err, res) {
    if (err) { return cb(err, res); }
    validateDatabaseUsername(username, function(err, res) {
      if (err) { return cb(err, res); }
      cb(null);
    });
  });
});

// get the text needs to be pasted to portal_ext properties
// to use this database
var getPortalConnectInfo = (function(db_id, cb) {
  Registry.find({_id: db_id}).lean().exec(function(err, doc) {
    console.log('db found');
    if (typeof(doc[0]) == 'undefined') {
      return cb('db is undefined, id: ' + db_id);
    }
    console.log(doc[0]);

    var json_data = {
      'filename': APP_ROOT + '/views/snipplets/portal_connect_info.ejs',
      'db_data': doc[0]
    };

    renderEjsTemplate(
        json_data.filename,
        json_data,
        function(err, res) {
          if (err) {
            console.log('error: ' + err);
            return cb(err);
          }
          cb(null, res);
        });
  });

});

// Render a new list of database entry, and returns the generated html
var newDbRow = (function(data, cb) {
  console.log('before rendering template');
  console.log(data);

  renderEjsTemplate(
  APP_ROOT + '/views/snipplets/dblist_row.ejs',
  {
    dbrow: data,
    username: data.username
  },
  function(err, html) {
    if (err) { return cb(err); }
    cb(null, html);
  });

});

var registerDatabase = (function(dbInfo, serverInfo, cb) {

  var expire_date = new Date();
  expire_date.setDate(expire_date.getDate() + 30);

  var new_database = new Registry({
    username: dbInfo.username,
    db_name: dbInfo.db_name.toLowerCase(),
    db_username: dbInfo.db_username,
    db_password: dbInfo.db_password,
    db_server: dbInfo.db_server,
    db_port: serverInfo.port,
    db_host: serverInfo.host,
    expires: expire_date.toISOString().substr(0,10),
    import_file: dbInfo.import_file
  });

  new_database.save(function(err) {
    if (err) { return cb(err); }
    cb(null, new_database);
  });
});

var getDatabaseServers = (function(cb) {
  DBServers.find().lean().exec(function(err, docs) {
    if (err) { return cb(err); }
    return cb(null, docs);
  });
});

// returns the database server connect information
var getDatabaseServer = (function(server_name, cb) {
  console.log('---- looking up server by name: ' + server_name);
  DBServers.find({name: server_name}).lean().exec(function(err, dbres) {
    if (err) { return cb(err); }
    if (typeof(dbres[0]) == 'undefined') {
      console.log('no db server with that name: ' + server_name);
      return cb('no database server found with this name: ' + server_name);
    }
    var db = dbres[0];
    var dbInfo = {
      name: db.name,
      host: db.host,
      port: db.port,
      admin_username: db.admin_username,
      admin_password: db.admin_password
    };
    cb(null, dbInfo);

  });
});

// get the string required to connect to the given database server
var getDatabaseConnectString = (function(serverInfo, cb) {
  var connect_string = 'mysql -u' +
    serverInfo.admin_username +
    ' -p' +
    serverInfo.admin_password +
    ' -h ' +
    serverInfo.host +
    ' -P ' +
    serverInfo.port;

  cb(null, connect_string);
});

// get a command that can be executed in worker nodes
// in order to execute the query in a given database backend

var createMysqlCommand = (function(connect_string, query, cb) {
  var mysql_command = connect_string +
    ' -e \'' +
    query +
    '\'';
  cb(null, mysql_command);
});

module.exports.createMysqlCommand = createMysqlCommand;
module.exports.getDatabaseConnectString = getDatabaseConnectString;
module.exports.registerDatabase = registerDatabase;
module.exports.newDbRow = newDbRow;
module.exports.getPortalConnectInfo = getPortalConnectInfo;
module.exports.getDatabaseByName = getDatabaseByName;
module.exports.validateDatabaseConnectInfo = validateDatabaseConnectInfo;
module.exports.grantDatabasePermissions = grantDatabasePermissions;

module.exports.getDatabaseServer = getDatabaseServer;
module.exports.getDatabaseServers = getDatabaseServers;
module.exports.getDatabaseById = getDatabaseById;
