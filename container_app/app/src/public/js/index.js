$ = jQuery = require('jquery');
var m = require('moment-timezone');

require('bootstrap');

$(document).ready(function() {

  socket.on('connect', function(res) {
    // ask for the stuff
    console.log('socket connected');
    socket.emit('get_event_log');
    socket.emit('show_file_list', {current_directory: 'BASE_DIR'});
    console.log('asking for db list');
    socket.emit('get_db_list');

    // enforce 'connected' state
    $('.connection-status').removeClass('alert-warning');
    $('.connection-status').addClass('alert-success');
    $('.connection-status').html('');

    // ask for the token list
    socket.emit('get_token_list');
  });

  socket.on('display_token_list', function(data) {
    console.log(data);
    data.forEach(function(token) {
      $('.user_token_list').append(token.token_id + '<br>');
    });
  });

  socket.on('display_token', function(data) {
    console.log('displaying token: ');
    $('.user_token_list').append(data.token_id + '<br>');
  });

  // receive and display event log
  socket.on('display_event_log', function(data) {
    var eventlog = '';
    var target_div = $('.d_progress');
    if (data.messages.length > 0) {
      data.messages.forEach(function(msg) {
        eventlog += msg.friendly_ts + ' > ' + msg.message + '<br>';
      });

      target_div.html(eventlog);
    }
  });

  socket.on('connect_error', function(err) {
    console.log('socket connection error: ' + err);
  });

  socket.on('connect_timeout', function(err) {
    console.log('socket connect timeout: ' + err);
  });

  // display a new database row, often as a result of clone / insert
  socket.on('add_db_row', function(data) {
    console.log('adding db_row');
    // check for username if we should or should not display it
    var username = data.username;
    var current_user = $('#current_user').html();
    var show_only_mine;

    var box = $('#show_only_mine');
    if (box.hasClass('checked')) {
      show_only_mine = 'on';
    } else {
      show_only_mine = 'off';
    }

    if (current_user === username || show_only_mine == 'off') {
      $('#db_table tr:last').after(data.html_data);
      $('.popover-btn').popover();
      $('.popover-btn').on('click', function(e) {
        $('.popover-btn').not(this).popover('hide');
      });
    }
  });

  // FIXME It can be simpler. much simpler.
  socket.on('set_show_only_mine', function(data) {
    console.log('setting up set_show_only_mine');
    console.log(data);
    if (data == '1') {
      $('#show_only_mine').addClass('checked');
      $('#show_only_mine').prop('checked', true);
      console.log('setting checked to true');
    } else {
      $('#show_only_mine').removeClass('checked');
      $('#show_only_mine').prop('checked', false);
      console.log('setting checked to false');
    }
  });

  // display event the event log
  socket.on('event_log', function(data) {
    var new_content = data.html_message;
    var target = $('.d_progress');
    var current_content = target.html();
    $('.d_progress').html(new_content + current_content);
  });

  // enable / disable controls on a specific row
  socket.on('switch_controls', function(data) {
    var id = data.id;
    var is_enabled = data.is_enabled;
    if (is_enabled) {
      $('.controls_' + id).removeClass('disabled');
      setControlClass(id,'status_ok');
    } else {
      $('.controls_' + id).addClass('disabled');
      setControlClass(id,'status_progress');
    }
  });

  // tell the client if we're reconnecting.
  socket.on('reconnecting', function() {
    $('.connection-status').removeClass('alert-success');
    $('.connection-status').addClass('alert-warning');
    $('.connection-status').html('Connection lost, Reconnecting ');
    console.log('socket is trying to reconnect..');
  });

  socket.on('reconnect_error', function(err) {
    console.log('socket reconnect failed: ' + err);
  });

  socket.on('reconnect_failed', function(err) {
    console.log('socket reconnect failed, giving up');
    $('.connection-status').html(
      'Retry limit reached, giving up reconnection ');
  });

  socket.on('notification', function(data) {
    var current_notification = $('#notification').html();
    $('#notification').html(current_notification + '<br>' + data.msg);
  });

  var setControlClass = (function(id, status_class) {
    $('#row_status_' + id).removeClass('status_removed');
    $('#row_status_' + id).removeClass('status_progress');
    $('#row_status_' + id).removeClass('status_ok');
    $('#row_status_' + id).removeClass('status_error');
    $('#row_status_' + id).addClass(status_class);
  });

  socket.on('set_row_status', function(data) {
    var id = data.id;
    var desired_class = data.desired_class;
    setControlClass(id, desired_class);
  });

  socket.on('update_db_row', function(data) {
    var db_id = data.db_id;

    if (data.action == 'start_remove') {
      $('#dbrow_status_' + db_id).html('Being removed');

    } else if (data.action == 'finish_remove') {
      $('#dbrow_status_' + db_id).html('Removed');
      setControlClass(db_id, 'status_removed');

    } else if (data.action == 'error_remove') {
      $('#dbrow_status_' + db_id).html(
        'Failed to remove, because: ' + data.msg);

      setControlClass(db_id, 'status_error');
    }
  });

  // ask every count from the backend which will send
  // back the numbers which we will display.
  socket.on('update_db_row_status', function(data) {
    var db_id = data.db_id;
    var message = data.msg;
    $('#dbrow_status_' + db_id).html(message);
  });

  // server send us an update about the available test databases.
  socket.on('update_dblist', function(data) {
    console.log('got update_dblist');
    $('.db_list').html(data.html_data);
    $('.popover-btn').popover();
    $('.popover-btn').on('click', function(e) {
      $('.popover-btn').not(this).popover('hide');
    });
  });

  // Just display the rendered html in the corresponding div
  socket.on('display_files', function(data) {
    $('.file_selection').html(data.html_data);
  });

  $(document).on('click', '.import_mysql', function(e) {
    var ref = $(this).attr('ref');
    var file = $(this).parent().parent().attr('ref');
    $('#db_input_ref').val(ref);
    $('#db_input_file').val(file);

    // request a new import for this file
    // display a form where the user can define his
    // username/password/dbname preferences
  });

  // submit form with a link, just
  $(document).on('keypress','#userPassword', function(e) {
    if (e.which == 13) {
      e.preventDefault();
      $('.login-form-submit').click();
    }
  });

  $(document).on('click','.login-form-submit', function(e) {
    e.preventDefault();
    $(this).closest('form').submit();
  });

  $(document).on('click', '.do_update_owner', function(e) {

    var update_info = {
      db_id: $('#update_owner_db_id').val(),
      owner: $('#new_db_owner').val()
    };
    socket.emit('do_update_owner', update_info);
  });

  $(document).on('click', '.do_clone_db', function(e) {

    var clone_info = {};
    clone_info.src_db_id = $('#db_clone_ref').val();
    clone_info.dst_db_type = $('#target_db_type').val();
    clone_info.dst_db_name = $('#dst_db_name').val();
    clone_info.dst_db_username = $('#dst_db_username').val();
    clone_info.dst_db_password = $('#dst_db_password').val();
    clone_info.request_email = $('#request_clone_email').is(':checked');
    socket.emit('do_clone_db', clone_info);
  });

  $(document).on('click','.do_create_db', function(e) {
    var ref = $('#db_input_ref').val();
    var file = $('#db_input_file').val();

    // now lets see if the user specified the username/password/dbname
    socket.emit('request_import', {
      db_server: ref, import_file: file,
      username: $('#db_input_username').val(),
      password: $('#db_input_password').val(),
      dbname: $('#db_input_dbname').val(),
      request_email: $('#request_email').is(':checked')
    });

    // zero those fields
    $('#db_input_username').val('');
    $('#db_input_password').val('');
    $('#db_input_dbname').val('');
  });

  $(document).on('click', '.extend_30days', function(e) {
    e.preventDefault();
    var ref = $(this).attr('ref');
    socket.emit('extend_30days', {db_id: ref});
  });

  $(document).on('click', '.remove_db', function(e) {
    e.preventDefault();
    var ref = $(this).attr('ref');
    socket.emit('remove_db',{db_id: ref});
  });

  $(document).on('click', '.update_owner', function(e) {
    var db_id = $(this).attr('ref');
    $('#update_owner_db_id').val(db_id);
  });

  $(document).on('click', '.clone_db', function(e) {
    var db_id = $(this).attr('ref');
    $('#db_clone_ref').val(db_id);
  });

  $(document).on('click', '#file_list_back', function(e) {
    socket.emit('show_file_list', {current_directory: 'BASE_DIR'});
  });

  $(document).on('click', '.click_dir', function(e) {
    var ref = $(this).attr('ref');
    socket.emit('show_file_list', {current_directory: ref});
  });

  $(document).on('click', '.purge_db_record', function(e) {
    e.preventDefault();
    socket.emit('purge_db_record', {db_id: $(this).attr('ref')});
  });

  $(document).on('click', '#show_only_mine', function(e) {
    var box = $(this);
    if (box.hasClass('checked')) {
      box.removeClass('checked');
      socket.emit('set_session',{
        'session_key': 'show_only_mine',
        'session_value': '0'
      });
    } else {
      box.addClass('checked');
      socket.emit('set_session',{
        'session_key': 'show_only_mine',
        'session_value': '1'
      });
    }
    socket.emit('get_db_list');
  });

  $(document).on('click', '.show_status', function(e) {
    e.preventDefault();
    var id = $(this).parent().attr('ref');
    var work_div = $('#dbrow_tr_status_' + id);
    if (work_div.hasClass('hidden')) {
      work_div.removeClass('hidden');
    } else {
      work_div.addClass('hidden');
    }
  });

  $(document).on('click', '.db_info', function(e) {
    var my_id = $(this).attr('ref');
    var dbrow = $('#dbrow_' + my_id).attr('ref');
    var dbrow_json = JSON.parse(dbrow);
    console.log(dbrow);
    $('.info_expires').html(dbrow_json.expires);
    $('.info_db_username').html(dbrow_json.db_username);
    $('.info_db_password').html(dbrow_json.db_password);
    $('.info_db_port').html(dbrow_json.db_port);
    $('.info_db_name').html(dbrow_json.db_name);
    $('.info_db_host').html(dbrow_json.db_host);
    socket.emit('show_portal_db_info', {db_id: my_id, dbrow_json: dbrow_json});

    $('.modal_db_info').modal('show');
  });

  $(document).on('click', '.new_database', function(e) {
    e.preventDefault();
    console.log('showing new database modal');
    $('#modal_new_database').modal('show');
    console.log('modal is shown');
  });

  $(document).on('click', '.show_user_tokens', function(e) {
    e.preventDefault();
    $('#modal_token_management').modal('show');
  });

  $(document).on('click', '.request_token', function(e) {
    e.preventDefault();
    socket.emit('request_token');
  });

  $(document).on('click', '.just_create_db', function(e) {
    e.preventDefault();

    var ref = $('#db_new_ref').val();
    var dbInfo = {
      db_username: $('#db_new_username').val(),
      db_password: $('#db_new_password').val(),
      db_name: $('#db_new_dbname').val(),
      request_email: $('#db_new_request_email').is(':checked'),
      db_server: $('#db_new_server_name').val()
    };

    socket.emit('just_create_new_db', dbInfo);

  });
});
