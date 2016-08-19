var mongoose = require('mongoose');

mongoose.connect('mongodb://mongo/dbtest');

var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('mongodb connection succesful');
});

// the database which is storing informations about the created databases
var registry_schema = mongoose.Schema({
  username: String, // owner of the database
  expires: Date, // when it will expire
  import_file: String, // where does it come from
  db_name: String, // database name
  db_username: String, // username for connecting to the database
  db_password: String, // password connecting to the database
  db_server: String, // server unique name (dbservers.name)
  db_port: Number, // (deprecated) database server port
  db_host: String, // (deprecated) database server host
  db_status_code: String, // (deprecated) last status seen
  db_status_message: String, // (deprecated) last message seen
  private: Number // private databases are visible only to admins & owner
  // if field is set, it's private
  // if no field, it's not private.
});

var events = mongoose.Schema({
  ts: String, // timestamp
  username: String, // username who generated the event
  db_id: String, // related database ID
  message: String // message describing the event
});

// database servers
var dbservers = mongoose.Schema({
  name: String, // unique database server name, e.g.: office_mysql_56_1
  version: String, // e.g.: 5.6
  host: String, // e.g.: mysql_56.local
  port: String, // e.g.: 3306
  friendlyname: String, // e.g.: MySQL 5.6
  provider: String, // e.g.: mysql
  admin_username: String,
  admin_password: String
});

var user_schema = mongoose.Schema({
  username: String,
  last_login: Date,
  isAdmin: Number,
  tokens: [
    {
      token_id: String,
      token_name: String
    }
  ]
});

var token_schema = mongoose.Schema({
  token_id: String,
  username: String,
  last_used: Date
});

var eventLog = mongoose.model('db_events', events);
var registry = mongoose.model('db_registry', registry_schema);
var dbservers = mongoose.model('db_servers', dbservers);
var user = mongoose.model('users', user_schema);
var token = mongoose.model('token', token_schema);

module.exports.registry = registry;
module.exports.events = eventLog;
module.exports.dbservers = dbservers;
module.exports.token = token;
module.exports.user = user;
