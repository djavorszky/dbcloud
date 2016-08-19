var projectname = require('project-name-generator');

var generateName = function() {
  var str = projectname({words: 1}).raw + '_' + projectname({words: 1}).raw;
  return str.substring(0,15);
};

var generateIfEmpty = function(str) {
  if (str === undefined) {
    return generateName();
  }
  if (str.length > 2) {
    return str.substring(0,15);
  } else {
    return generateName();
  }
};

module.exports.generateName = generateName;
module.exports.generateIfEmpty = generateIfEmpty;
