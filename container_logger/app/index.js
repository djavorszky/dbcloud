// log receiver
// implements zmq socket handling on the top of the iscovery layer

var zmq = require('zmq');

// discovery
var zComm = require('zmq-comm');

var filter = {
  type: 'zmq'
};

var fs = require('fs');
var logfile = '/var/log/app.log';
var wstream = fs.createWriteStream(logfile, {flags: 'a'});

var interval = 2000;
var log_senders = [];
var retry_limit = 3;

var newListener = (function(peer) {
  var peerData = peer.split(':');
  var ip = peerData[0];
  var port = peerData[1];
  var retry_count = 0;

  // connect socket
  console.log('connecting socket to: ' + peer);
  var app_socket = zmq.socket('sub');
  app_socket.connect('tcp://' + peer);
  app_socket.subscribe('log_message');

  // handle retry
  app_socket.on('connect_retry', function(fd, ep) {
   console.log('retry: ' + ep + '(' + retry_count + ' / ' + retry_limit + ')');
   retry_count += 1;
   if (retry_count > retry_limit) {
    console.log('retry limit reached, disconnecting');
    var sender_idx = log_senders.indexOf(ip + ":" + port);
    log_senders.splice(sender_idx, 1);
    try {
      app_socket.unmonitor();
      app_socket.close();
      console.log('socket closed to ' + peer)
      return;
    } catch(e) {
      console.log('I think the socket is already closed, leaving it alone.');
      return
    }
    console.log('connections after disconnecting a client');
    console.log(log_senders);
   }
  });

  app_socket.on('message', function(topic, data) {
    var log_obj = JSON.parse(data);
    console.log('got message: ' + log_obj.message);
    try {
      wstream.write(log_obj.ts + ' > ' + log_obj.message + '\n');
    } catch(e) {
      console.log('got error on stream write');
      console.log(e);
      throw(e);
    }

  });

  app_socket.on('connect', function(fd, ep) {
   retry_count = 0;
   console.log('connected: ' + ep);
   if (log_senders.indexOf(peer) < 0) {
     log_senders.push(peer);
     console.log('current log senders');
     console.log(log_senders);
     console.log('----------');
   } else {
     console.log('peer is already in the list: ' + ep + ' <> ' + peer);
   }
  });

  app_socket.monitor(900, 0);
});

var ServiceDiscover = new zComm.DiscoverService(filter, interval);
console.log('[discovery] launched started');
console.log(filter);


ServiceDiscover.on('up', function(s) {
  var peer = s.host + ':' + s.port;
  if (log_senders.indexOf(peer) < 0) {
    console.log('new peer: ' + peer);
    newListener(peer);
  }
  s = null;
  peer = null;
});

ServiceDiscover.on('down', function(s) {
  console.log('[discovery] service down: ' + s);
  s = null;
  return;
});

ServiceDiscover.on('error', function(s) {
  console.log('[discovery] service error');
  console.log(s);
  console.log('----------------');
  s = null;
  return;
});
