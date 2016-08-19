var CronJob = require('cron').CronJob;
var request = require('request');
var os = require('os');
var ifaces = os.networkInterfaces();
var node = require('uuid4')();
var logger = require('zmq-log-sender');
var request = require('request');
var api_servers = [];
var async = require('async');
var rnd = require('randomstring');

// find an ApiServer
var zComm = require('zmq-comm');

var ServiceDiscover = new zComm.DiscoverService({
  type: 'http_apiserver',
}, 5000);

ServiceDiscover.on('up', function(service) {
  peer = service.host + ':' + service.port;
  console.log('peer up: ' + peer);
  api_servers.push(peer);
  console.log('connected peers');
  console.log(api_servers);
});

ServiceDiscover.on('down', function(service) {
  peer = service.host + ':' + service.port;
  console.log('peer down: ' + peer);
  var server_index = api_servers.indexOf(peer);
  if (server_index >= 0) {
    api_servers.splice(server_index, 1);
  } else {
    console.log('weird... an api server went down, but I wasnt even saw it up');
  }
});


// advertise myself as a logger service
var zAdvert;

setTimeout(function() {
  ifaces = os.networkInterfaces();
  var myAdvert = {
    name: 'log_sender_' + node,
    type: 'zmq',
    port: 1784,
    host: ifaces.eth0[0].address
  };
  zAdvert = new zComm.AdvertiseService(myAdvert);
  startService();
}, 5000);

// get an URL, return JSON response
var sendRequest = (function(req_url, type, cb) {
  console.log('sending request: ' + req_url);
  request({
    url: req_url,
    method: type,
  }, function(error, response, body) {
    if (error) {
      return cb('request error: ' + error);
    }
    if (response.statusCode != 200) {
      console.log(response.body);
      return cb('maint> response error');
    }
    try {
      response_obj = JSON.parse(response.body);
    } catch(e) {
      console.log('it was not a json reply, but I dont really care.');

      cb(null, {
        response: response.body
      });
    }
    cb(null, response_obj);

  });
});

// ask from the API
var getRegisteredDatabases = (function(server, cb) {
  console.log('available api servers');
  console.log('---------------------');
  console.log(api_servers);
  console.log(server);
  sendRequest('http://' + api_servers[0] +
  '/v1/databases?token=' + process.env.NETWORK_KEY + '&backend_name=' +
  server.name, 'GET', function(err, res) {
    if (err) {
      return cb(err);
    }
    cb(null, res);
  });

});

// ask from the API
var getActualDatabases = function(server, cb) {
  console.log('available api servers');
  console.log('---------------------');
  console.log(api_servers);
  console.log(server);
  sendRequest('http://' + api_servers[0] +
  '/v1/backendDatabases?token=' + process.env.NETWORK_KEY + '&backend_name=' +
  server.name, 'GET', function(err, res) {
    if (err) {
      return cb(err);
    }
    cb(null, res);
  });
};


// collect registered, and available databases from a given
// list of database servers (backends)

var actual_databases = [];
var registered_databases = [];

var getDatabaseList = (function(dbServers, cb) {
  registered_databases = [];
  actual_databases = [];
  async.each(dbServers, function(server, callback) {
    getActualDatabases(server, function(err1, dbs) {
      if (err1) {
        console.log('error in getDatabaseList: ');
        console.log(err1);
      } else {
        for(var x = 0; x < dbs.length; x++) {
          actual_databases.push(dbs[x]);
        }
      }

      getRegisteredDatabases(server, function(err, dbs) {
        if (err) {
          console.log('error in getDatabaseList: ');
          console.log(err);
        }
        if (typeof(dbs) != 'undefined') {
          for(var z = 0; z < dbs.length; z++) {
            registered_databases.push(dbs[z]);
          }
        }

        callback(null);
      });

    });


  }, function(err) {
       if (err) {
        console.log('got error after iterating trough dbs in getDatabaseList: ' + err);
        return cb(err);
       }

       cb(null, {
         registered_databases: registered_databases,
         actual_databases: actual_databases
       });
  });

});

var findOrphanMysqlDatabases = (function() {
  // get database servers
  var requestData = 'http://' + api_servers[0] +
      '/v1/databaseBackends?token=' +
      process.env.NETWORK_KEY;

  request({
    url: requestData,
    method: 'GET',
  }, function(error, response, body) {
    if (error) {
      console.log('request error: ' + error);
      return;
    }
    if (response.statusCode != 200) {
      logger('maint > response error');
      console.log(error);
      console.log(body);
      console.log(response);
    }
    logger('maint > response ok');
    response_obj = JSON.parse(response.body);
    console.log(response_obj);

    getDatabaseList(response_obj, function(err, databases) {
      if (err) {
        console.log('there was an error while collecting database list');
        console.log(err);
      }
      console.log(' ++++++++++++++++++ databases ++++++++++++++++++++++ ');
      console.log(' +++++++++++++++++++++++++++++++++++++++++++++++++++ ');
      console.log(databases);

      // databases: {
      //   actual_databases: [ ... {name, backend_name} ....],
      //   registered_databases: [ ... {db_name, db_server, username} .... ]
      // }

      // --> Databases exists in dbcloud, but not really:
      var invalid_databases = findInvalidDatabases(databases);

      // --> Databases exists, but not in dbcloud:
      var missing_databases = findMissingDatabases(databases);
    });
  });
});

// --> Databases exists in dbcloud, but not really:
var findInvalidDatabases = (function(databases) {
  var found;
  databases['registered_databases'].forEach(function(registered_db) {
    console.log('checking: ' + registered_db.db_name);
    found = 0;
    databases['actual_databases'].forEach(function(actual_db) {
      if (registered_db.db_name == actual_db.name) {
        found = 1;
      }
    });
    console.log('found: ' + found);
    if (found == 0) {
      console.log('invalidating: ' + registered_db.db_name);
      sendRequest('http://' + api_servers[0] +
      '/v1/invalidateDatabase?token=' + process.env.NETWORK_KEY + '&db_name=' +
      registered_db.db_name, 'GET', function(err, res) {
        if (err) {
          console.log('error: ' + err);
          return;
        }
      });
    }
  });
});

// --> Databases exists, but not in dbcloud:
var findMissingDatabases = (function(databases) {
  // iterate trough the actual databases and find a match
  // awww I need to implement another API function: create database.
  // oh, I already have it, but it's high-level. damn.
  var found;
  databases['actual_databases'].forEach(function(living_db) {
    console.log('checking: ' + living_db.name);
    found = 0;
    databases['registered_databases'].forEach(function(registered_db) {
      if (living_db.name == registered_db.db_name) {
        found = 1;
      }
    });
    if (found == 0){
      console.log('orphan database found: ' + living_db.name);
      // call createDatabase with registeronly

      // generate a random username to avoid colliding with valid usernames
      var random_username = rnd.generate(10);

      var requestData = 'http://' + api_servers[0] +
          '/v1/database?token=' +
          process.env.NETWORK_KEY +
          '&backend_name=' + living_db.backend_name + '&'+
          'name=' + living_db.name + '&' +
          'username=' + random_username + '&' +
          'password=unknown&registryOnly=yes';

      console.log('sending request');
      console.log(requestData);
      request({
        url: requestData,
        method: 'POST',
      }, function(error, response, body) {
        if (error) {
          console.log('error creating placeholder: ' + error);
        };
        console.log('placeholder created');
        if (response.statusCode == '500') {
          console.log('failed');
        } else {
          console.log(response.statusCode + ', maybe success');
        }

      });
    }
  });
});

var startService = function() {
  logger('maintenance: enabling services');
  var job = new CronJob('15 * * * *', function() {
    console.log('executing job');
    logger('maintenance job is executing at ' + new Date());
    findOrphanMysqlDatabases();
  });

  job.start();
}

