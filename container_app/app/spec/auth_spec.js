 var auth = require(process.env.APP_ROOT + '/lib/auth.js');

 describe('validate-username-no-dot', function() {
   var result;
   var error;
   beforeEach(function(done) {
     auth.validateUserName('testinguser', function(err, res) {
       result = res;
       error = err;
       done();
     });
   });

   it("should return an error", function() {
     expect(error).not.toBe(null);
   });

 });
 describe('validate-too-sort-username', function() {
   var result;
   var error;
   beforeEach(function(done) {
     auth.validateUserName('tes', function(err, res) {
       result = res;
       error = err;
       done();
     });
   });

   it("should return an error", function() {
     expect(error).not.toBe(null);
   });

 });
 describe('validate-username', function() {
   var result;
   var error;
   beforeEach(function(done) {
     auth.validateUserName('test.bot', function(err, res) {
       result = res;
       error = err;
       done();
     });
   });

   it("should not return error", function() {
     expect(error).toBe(null);
   });

 });

 describe('auth-testbot', function() {
   var result;
   var error;
   beforeEach(function(done) {
     auth.isAdmin('test.bot', function(err, res) {
       result = res;
       error = err;
       done();
     });
   });

   it("should not return error", function() {
     expect(error).toBe(null);
   });

   it("should not an admin", function() {
     expect(result).toBe(1);
   });
 });

 describe('auth-randomuser', function() {
   var result;
   var error;
   beforeEach(function(done) {
     auth.isAdmin('random.user', function(err, res) {
       result = res;
       error = err;
       done();
     });
   });

   it("should not return error", function() {
     expect(error).toBe(null);
   });

   it("should not an admin", function() {
     expect(result).toBe(0);
   });
 });

