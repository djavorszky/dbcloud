'use strict';

var url = require('url');

var Backend = require('./BackendService');

module.exports.databaseBackendDELETE = function databaseBackendDELETE (req, res, next) {
  Backend.databaseBackendDELETE(req.swagger.params, res, next);
};

module.exports.databaseBackendGET = function databaseBackendGET (req, res, next) {
  Backend.databaseBackendGET(req.swagger.params, res, next);
};

module.exports.databaseBackendsGET = function databaseBackendGET (req, res, next) {
  Backend.databaseBackendsGET(req.swagger.params, res, next);
};

module.exports.databaseBackendPOST = function databaseBackendPOST (req, res, next) {
  Backend.databaseBackendPOST(req.swagger.params, res, next);
};
