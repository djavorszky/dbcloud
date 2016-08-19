'use strict';

var app = require('connect')();
var http = require('http');
var swaggerTools = require('swagger-tools');
var jsyaml = require('js-yaml');
var fs = require('fs');
var serverPort = 8077;
var logger = require('zmq-log-sender');
console.log('starting apiserver');

// advertise ourself as an API Server

var Zcomm = require('zmq-comm');
var os = require('os');
var ifaces;

// wait
setTimeout(function() {
  ifaces = os.networkInterfaces();
  var myAdvert = {
    name: 'api_server_',
    port: 8077,
    type: 'http_apiserver',
    host: ifaces.eth0[0].address
  };

  var myAdvert2 = {
    name: 'log_sender_',
    port: 1784,
    type: 'zmq',
    host: ifaces.eth0[0].address
  };

  console.log('starting advert');
  console.log(myAdvert);
  var zAdvert = new Zcomm.AdvertiseService(myAdvert);
  var zAdvert2 = new Zcomm.AdvertiseService(myAdvert2);

  zAdvert.on('error', function(err) {
    console.log(myAdvert);
    console.log('error with advertistment');
  });
}, 6000);


// swaggerRouter configuration
var options = {
  swaggerUi: '/swagger.json',
  controllers: './controllers',
  useStubs: process.env.NODE_ENV === 'development' ? true : false // Conditionally turn on stubs (mock mode)
};

// The Swagger document (require it, build it programmatically, fetch it from a URL, ...)
var spec = fs.readFileSync('./api/swagger.yaml', 'utf8');
var swaggerDoc = jsyaml.safeLoad(spec);

// Initialize the Swagger middleware
swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {
  // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
  app.use(middleware.swaggerMetadata());

  // Validate Swagger requests
  app.use(middleware.swaggerValidator());

  // Route validated requests to appropriate controller
  app.use(middleware.swaggerRouter(options));

  // Serve the Swagger documents and Swagger UI
  app.use(middleware.swaggerUi());

  // Start the server
  http.createServer(app).listen(serverPort, function () {
    console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
    console.log('Swagger-ui is available on http://localhost:%d/docs', serverPort);
  });
});
