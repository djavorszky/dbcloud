// get a filename, and returns the error, and the command needed to read
// the file (error-first, not a callback, but just returning an array)

// expects: filename (string)
// returns [err, result]

var dump_info = {
  '.sql$': 'cat',
  '.sql.gz$': 'zcat',
  '.sql.bz2$': 'bzcat',
  '.sql.zip$': 'unzip -p',
  '.sql.7z$': '7z_wrapper'
};

var getDumpInfo = function(file_name) {
  var have_match = 0;
  var idx;
  for (idx in dump_info) {
    if (file_name.match(idx)) {
      have_match = 1;
      return [null, dump_info[idx]];
    }
  }

  if (have_match === 0) {
    return ['no known extension matches for ' + file_name, 'null'];
  }
};

module.exports = getDumpInfo;
