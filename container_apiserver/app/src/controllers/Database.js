'use strict';

var url = require('url');

var Database = require('./DatabaseService');

module.exports.backendDatabasesGET = function backendDatabasesGET (req, res, next) {
  Database.backendDatabasesGET(req.swagger.params, res, next);
};

module.exports.databaseDELETE = function databaseDELETE (req, res, next) {
  Database.databaseDELETE(req.swagger.params, res, next);
};

module.exports.databaseGET = function databaseGET (req, res, next) {
  Database.databaseGET(req.swagger.params, res, next);
};

module.exports.databasePOST = function databasePOST (req, res, next) {
  Database.databasePOST(req.swagger.params, res, next);
};

module.exports.databasesGET = function databasesGET (req, res, next) {
    Database.databasesGET(req.swagger.params, res, next);
};

module.exports.invalidateDatabaseGET = function invalidateDatabaseGET (req, res, next) {
  Database.invalidateDatabaseGET(req.swagger.params, res, next);
};
