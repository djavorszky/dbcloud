var nodemailer = require('nodemailer');
var sgTransport = require('nodemailer-sendgrid-transport');

var options = {
  auth: {
    api_key:
      process.env.SENDGRID_API_KEY
  }
};

var send = function(data) {
  var email = {
    to: [data.to],
    from: data.from,
    subject: data.subject,
    html: data.html
  };

  var mailer = nodemailer.createTransport(sgTransport(options));

  if (process.env.PROD === 0) {
    console.log('development code wont send out emails');
  } else {
    mailer.sendMail(email, function(err, res) {
      if (err) {
        console.log(err);
      }
      console.log(res);
      console.log('message sent to ' + email.to[0]);
    });
  }
};

module.exports.send = send;
