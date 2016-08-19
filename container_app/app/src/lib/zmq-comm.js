// responsible for communication between the services.

var zmq = require('zmq');
var EventEmitter = require('events');
var util = require('util');

// ------ opts --------
// name (string)
// host (string, optional) - defaults to local hostname
// port (number)
// type (string)
// subtypes (array of strings, optional)
// protocol (string, optional) - udp or tcp (default)
// txt (object, optional) - a key/value object to broadcast as the TXT record

// ***** Public method ********** //

var AdvertiseService = (function(opts) {
  var me = this;
  var bonjour = require('bonjour')();
  process.nextTick(function() {
    var myService = bonjour.publish(opts);
    myService.on('error', function(e) {
      me.emit('error', e + ' :: stopping advertistment');
      myService.stop();
    });
    console.log('Advertistment is in place');
    console.log(opts);
  });
});

// ***** Public method ********** //

var DiscoverService = (function(filter) {
  var me = this;
  process.nextTick(function() {
    bonjour.find(filter, function(service) {
      me.emit('service_found', service);
    });
  });
});

util.inherits(AdvertiseService, EventEmitter);
util.inherits(DiscoverService, EventEmitter);

module.exports.AdvertiseService = AdvertiseService;
module.exports.DiscoverService = DiscoverService;
