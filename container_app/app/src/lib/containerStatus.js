var child_process = require('child_process');
var mysql = require('mysql');
var retry = require('retry');

exports.connectDB = function(myDbServer, cb) {
  var db_connect = retry.operation();
  db_connect.attempt(function(currentAttempt) {
    // !!! it shouldn't be hardcoded
    var connection = mysql.createConnection({
      host: myDbServer.host,
      user: 'root',
      password: process.env.SAMPLE_PASSWORD,
      database: 'mysql',
      port: myDbServer.db_port
    });
    connection.connect(function(err) {
      if (db_connect.retry(err)) {
        console.log('not connected, waiting..');
        console.log(myDbServer);
        console.log(err);
        return;
      }
      cb(err ? start_mysql.mainError() : null, connection);
    });
    connection.on('error', function(err) {
      console.log('db connection error');
      console.log(err);
    });
  });
};

exports.getDbServer = function(name, dbservers, callback) {
  var findDbserver = dbservers.filter(function(item) {
      return item.container == name;
    });
  var myDbServer = findDbserver[0];
  return callback(null,myDbServer);
};
