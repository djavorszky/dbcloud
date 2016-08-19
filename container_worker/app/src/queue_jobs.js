var child_process = require('child_process');
var logger = require('zmq-log-sender');

var os = require('os');

console.log('advertising log_sender service');
setTimeout(function() {
  var ifaces = os.networkInterfaces();
  var bonjour = require('bonjour')();
  var my_address = ifaces.eth0[0].address;
  bonjour.publish({
    name: my_address + '-worker_log_sender',
    type: 'zmq',
    port: 1784,
    host: my_address
  });
  console.log('publishing myself as ' + my_address);
}, 5000);

module.exports = function(queue) {
  console.log('queue processors online');

  // start watching queue
  console.log('start watching for stuck jobs');
  queue.watchStuckJobs(9000);

  // catch and log queue errors
  queue.on('error', function(err) {
    console.log('queue error: ' + err);
  });

  queue.process('db_operation', function(job, done) {
    job.progress(0,1);
    var db_operation_command = job.data;
    logger('worker> processing db operation: ' + db_operation_command);
    console.log('processing db operation: ' + db_operation_command);
    child_process.exec(db_operation_command, function(err, stdout, stderr) {
      if (err) {
        logger('worker> error: ' + err);
        console.log('queue worker returning an error: ' + err);
        return done(new Error(err));
      } else {
        console.log('stdout> ' + stdout);
        if (stderr.length > 2) {
          console.log('stderr size is big; it seems an error');
          logger('worker> error: ' + stderr);
          return done(new Error(stderr));
        } else {
          console.log('stderr> ' + stderr);
          logger('worker> job done: ' + db_operation_command);
          console.log('queue worker finished with success');
          console.log('sending back results of exec');
          done(null, stdout);
        }
      }
    });
  });
};
