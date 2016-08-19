// this module receive event messages, and log / send to frontend, acconding to
// the rules.
//

var Event = require(APP_ROOT + '/lib/db_registry.js').events;
// var moment = require('moment');
var moment = require('moment-timezone');

var send = (function(username, io, socket, message, callback) {
  // log the message to the database
  var ts = new Date();
  var local_ts = moment().tz('Europe/Budapest').calendar(ts);
  var final_message = '';
  var message_parts;

  if (message.indexOf('mysql') > -1) {
    message_parts = message.split('-e');
    final_message = message_parts[1];
  } else {
    final_message = message;
  }

  var new_event = new Event({
    ts: ts,
    username: username,
    message: final_message
  });

  new_event.save();

  // sanitize the output, don't show the database root credentials.
  // -e separates the connect string from the query

  socket.emit('event_log', {
    html_message: local_ts + ' > ' + final_message + '<br>'
  });
});

module.exports.send = send;
