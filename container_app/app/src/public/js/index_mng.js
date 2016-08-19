$ = jQuery = require('jquery');
var m = require('moment-timezone');

require('bootstrap');

$(document).ready(function() {
  console.log('ready');
  socket.on('connect', function() {
    console.log('socket ready');
  });

  socket.on('display_dbserver_form', function(data) {
    console.log('displaying dbserver form');
    console.log('html');
    $('#div_new_dbserver').html(data.html);
  });

  $(document).on('click', '#sample_dbservers', function(e) {
    console.log('asking server to install sample databases');
    socket.emit('install_sample_dbservers');
  });

  $(document).on('click', '#add_new_dbserver', function(e) {
    e.preventDefault();
    console.log('new dbserver');
    socket.emit('new_dbserver_form');
  });

  $(document).on('click', '.remove_dbserver', function(e) {
    e.preventDefault();

    var ref = $(this).attr('ref');
    console.log('removing dbserver: ' + ref);
    socket.emit('remove_dbserver', {_id: ref});
    $(this).closest('tr').remove();
  });

  $(document).on('click', '#new_dbserver_add', function(e) {
    var dbserver_obj = {
      name: $('#new_dbserver_name').val(),
      version: $('#new_dbserver_version').val(),
      host: $('#new_dbserver_host').val(),
      port: $('#new_dbserver_port').val(),
      friendlyname: $('#new_dbserver_friendly_name').val(),
      provider: $('#new_dbserver_provider').val(),
      admin_username: $('#new_dbserver_admin_username').val(),
      admin_password: $('#new_dbserver_admin_password').val()
    }

    socket.emit('register_new_dbserver', dbserver_obj);

  });

});
