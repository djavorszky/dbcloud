var fs = require('fs');
var ejs = require('ejs');

var renderEjsTemplate = (function(
  template_path, template_data, callback) {

  process.nextTick(function() {
    fs.readFile(template_path, function(err, fileData) {
      if (err) {
        return callback(err);
      } else {
        var html_data = ejs.render(fileData.toString(), template_data);
        callback(null, html_data);
      }
    });
  });
});

module.exports = renderEjsTemplate;
