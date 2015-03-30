var fs = require( 'fs' );
var path = require( 'path' );
var util = require( 'util' );

var handlebars = require( 'handlebars' );
var nodemailer = require( 'nodemailer' );
var nodemailerSesTransport = require( 'nodemailer-ses-transport' );
var juice = require( 'juice' );
var peliasConfig = require( 'pelias-config' ).generate()[ 'acceptance-tests' ].email;

[ 'recipients' ].forEach( function ( prop ){
  if( !peliasConfig.hasOwnProperty( prop ) ){
    console.error([
      'Your pelias-config\'s acceptance-tests.email object is missing the following property: ' + prop,
      'Expected properties are:',
      '\trecipients: an array of recipients\'s mailing addresses.',
      '\tses: options for nodemailer-ses-transport, for Amazon\'s SES.'
    ].join( '\n' ) );
    process.exit( 1 );
  }
});

function formatTestCase( res ){
  var id = res.testCase.id;
  var input = JSON.stringify( res.testCase.in, undefined, 4 );
  var status = (res.progress === undefined) ? '' :
    util.format( '<span class="status">%s</span> ', res.progress );

  var out;
  switch( res.result ){
    case 'pass':
      out = new handlebars.SafeString( util.format( '✔ %s[%s] "%s"', status, id, input ) );
      break;

    case 'fail':
      out = new handlebars.SafeString( util.format( '✘ %s[%s] "%s": %s', status, id, input, res.msg ) );
      break;

    case 'placeholder':
      return util.format( '! [%s] "%s": %s', id, input, res.msg );

    default:
      console.error( util.format( 'Result type `%s` not recognized.', res.result ) );
      process.exit( 1 );
  }

  return out;
}

function emailResults( suiteResults  ){
  handlebars.registerHelper( 'json', JSON.stringify );
  handlebars.registerHelper( 'testCase', formatTestCase );

  var templatePath = path.join( __dirname, 'email_static/email.html' );
  var emailTemplate = fs.readFileSync( templatePath ).toString();
  var emailHtml = juice( handlebars.compile( emailTemplate )( suiteResults ) );
  var transporter = nodemailer.createTransport( nodemailerSesTransport( peliasConfig.ses ) );

  var emailOpts = {
    from: peliasConfig.from || '"pelias-acceptance-tests" <noreply@pelias-acceptance-tests>',
    to: peliasConfig.recipients.join( ', ' ),
    subject: 'pelias acceptance-tests results ' + new Date().toString(),
    html: emailHtml
  };

  transporter.sendMail( emailOpts, function( err, info ){
    if( err ){
      console.error( JSON.stringify( err, undefined, 4 ) );
    }
    else {
      console.log( 'Sent: ', JSON.stringify( info, undefined, 4 ) );
    }
  });
}

module.exports = emailResults;
