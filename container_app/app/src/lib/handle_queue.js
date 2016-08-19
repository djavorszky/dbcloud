var kue = require('kue');
var queue = kue.createQueue({redis: {host: process.env.REDIS_HOST}});
var async = require('async');

var getIds = (function(state, cb) {
  // console.log(typeof(queue[state]));
  if (typeof(queue[state]) == 'function') {
    queue[state](function(err, ids) {
      cb(null, ids);
    });
  } else {
    return cb('queue.' + state + ' is not a function');
  }
});

var getJobs = (function(job_type, cb) {
  getIds(job_type, function(err, ids) {
    if (err) {
      return cb(err);
    }
    var job_list = [];
    async.forEachOf(ids, function(job_id, key, job_cb) {
      var job_info = {};
      kue.Job.get(job_id, function(err, job) {
        job_info.duration = job.duration;
        job_info.created_at = job.created_at;
        job_info.started_at = job.started_at;
        job_info.failed_at = job.failed_at;
        job_info.id = job.id;
        job_info.type = job.type;
        job_info.data = job.data;
        job_info.workerId = job.workerId;
        job_info.status = job_type;
        job_list.push(job_info);
        job_cb(null, job_info);
      });
    }, function(err, dt) {
      if (err) {
        return cb(err);
      } else {
        cb(null, job_list);
      }
    });
  });
});

module.exports.getJobs = getJobs;
