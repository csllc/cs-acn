#!/usr/bin/env node
/**
 * Example/demo for Control Solutions Advanced Control Network interface package
 *
 * Run the demo from the command line.  The port settings in the config.json
 * file will be used to connect to the ACN device and execute the command
 *
 */
'use strict';

// get application path
var path = require('path');

// console text formatting
var chalk = require('chalk');

// command-line options
var args = require('minimist')(process.argv.slice(2));

// Configuration defaults
var config = require('./config');

// Keep track of mode for output purposes
var isAscii = (config.master.transport.type === 'ascii');

// Load the object that handles communication to the device
var AcnPort = require('./acn-port');

// Load the object that handles communication to the device
var map = require('./lib/Map');

// override config file port name if necessary
config.port.name = args.port || process.env.MODBUS_PORT || config.port.name;

// override slave id if necessary
config.master.defaultUnit = args.slave || process.env.MODBUS_SLAVE || config.master.defaultUnit;

/**
 * Parses a string into a number with bounds check
 *
 * String can be decimal, or if it starts with 0x
 * it is interpreted as hex
 *
 * @param  {[string]} s       string to parse
 * @param  {[number]} default if string can't be parsed
 * @return {[number]}         the parsed number or the default
 */
function parseNumber( s, def )
{
  var number;

  if( 'undefined' === typeof( s )) {
    return def;
  }

  if( s.toString().substring(0,1) === '0x') {
    number = parseInt(s.substring(2), 16);
  }
  else {
    number = parseInt(s);
  }
  return number;

}

/**
 * Convert an array of args to an array of numbers
 *
 * Parses 0x as hex numbers, else decimal
 * @param  {[array]} args  string array
 * @param  {[number]} start offset in args to start parsing
 * @return {[array]}       array of numbers
 */
function argsToByteBuf( args, start )
{

  var values = [];

  for( var i = start; i< args.length; i++ ) {
    var number;

    if( args[i].toString().substring(0,1) === '0x') {
      number = parseInt(args[i].substring(2), 16);
    }
    else {
      number = parseInt(args[i]);
    }

    if( number < 0 || number > 255 ) {
      console.error( chalk.red('Invalid data value: ' + args[i] ));
        exit(1);
    }
    values.push(number);
  }

  return new Buffer(values);

}

/**
 * Convert an array of args to an buffer of 16-bit words
 *
 * Parses 0x as hex numbers, else decimal
 * @param  {[array]} args  string array
 * @param  {[number]} start offset in args to start parsing
 * @return {[Buffer]}       Buffer of words
 */
function argsToWordBuf( args, start )
{
  var builder = new buffers.BufferBuilder();

  for( var i = start; i< args.length; i++ ) {
    var number;

    if( args[i].toString().substring(0,1) === '0x') {
      number = parseInt(args[i].substring(2), 16);
    }
    else {
      number = parseInt(args[i]);
    }

    if( number < 0 || number > 65535 ) {
      console.error( chalk.red('Invalid data value: ' + args[i] ));
        exit(1);
    }
    builder.pushUInt16( number );
  }

  return builder.toBuffer();

}

if( args.h || args._.length < 1 ) {
  console.info( '\r--------ACN Utility: ' + config.port.name + '----------');
  console.info( 'Reads or writes from an ACN device\r');
  console.info( '\rCommand format:\r');
  console.info( path.basename(__filename, '.js') + '[-h -v] action [type] [...]\r');
  console.info( '    action: get/set/reset\r');
  console.info( '    type: what sort of item\r');
  console.info( chalk.bold('        factory') + ' configuration\r');
  console.info( chalk.bold('        user') + ' configuration\r');
  console.info( chalk.bold('        fifo') + ' data\r');
  console.info( '    id: the ID of the item\r');
  console.info( chalk.underline( '\rOptions\r'));
  console.info( '    -h          This help output\r');
  console.info( '    -v          Verbose output (for debugging)\r');
  console.info( chalk.underline( '\rResult\r'));
  console.info( 'Return value is 0 if successful\r');
  console.info( 'Output may be directed to a file\r');
  console.info( '    e.g. ' + chalk.dim('acn get factory >> myConfig.json') + '\r');


  process.exit(0);
}

//console.log( args );

// Check the action argument for validity
var action = args._[0];
var type;

if( ['read', 'write', 'get', 'set', 'reset', 'command'].indexOf( action ) < 0 ) {
  console.error(chalk.red( 'Unknown Action ' + action + ' Requested'));
  process.exit(1);
}


/**
 * If error, print it, otherwise print the result as an object dump
 * @param  {err}
 * @return null
 */
function output( err, response ) {
  if( err ) {
    console.log( chalk.red( err.message ) );
    exit(1);
  }
  else {
    console.log(response);
    exit(0);
  }
}

/**
 * If error, print it, otherwise print the result as a string
 * @param  {err}
 * @return null
 */
function outputText( err, response ) {
  if( err ) {
    console.log( chalk.red( err.message ) );
    exit(1);
  }
  else if( response.values ) {
    console.log(response.values.toString());
    exit(0);
  }
  else {
    console.log( chalk.red( 'No values returned' ) );
    exit(1);
  }
}

var port = new AcnPort( config.port.name, config );

// Attach event handler for the port opening
port.on( 'open', function () {

  // Now do the action that was requested
  switch( action ) {

    case 'read':
      // Validate what we are supposed to get
      var type = args._[1] || 'unknown';
        port.read( map[type] )
          .then(function(output) { console.log( map[type].title + ': ', output.format() ); exit(0); })
          .catch( function(e) { console.log( e); exit(1); } );
      break;

    case 'write':
      // Validate what we are supposed to get
      var type = args._[1] || 'unknown';
      var value = args._[2];

        port.write( map[type], value )
          .then(function() { console.log( map[type].title + ' written to ', map[type].format() ); exit(0); })
          .catch( function(e) { console.log( e); exit(1); } );
      break;

    case 'get':
      // Validate what we are supposed to get
      var type = args._[1] || 'unknown';

      switch( type ) {
        case 'slave':
          port.getSlaveId()
            .then(function(output) { console.log(output.toString()); exit(0); })
            .catch( function(e) { console.log( e); exit(1); } );
          break;

        case 'factory':
          port.getFactoryConfig()
            .then(function(output) { console.log(output); exit(0);})
            .catch( function(e) { console.log( e); exit(1); } );
          break;

        case 'user':
          port.getUserConfig( output );
          break;

        case 'net':
          port.getNetworkStatus( output );
          break;

        case 'scan':
          port.getScanResults( output );
          break;

        case 'connection':
          port.getConnections( output );
          break;

        case 'coord':
          port.getCoord( output );
          break;

        case 'debug':
          port.getDebug( outputText );
          break;

        default:
          console.error( chalk.red('Trying to get unknown item'));
          exit(1);
          break;
      }

      break;

    case 'set':
      // Validate what we are supposed to set
      var type = args._[1] || 'unknown';

      switch( type ) {
        case 'debug':
          port.master.writeFifo8( 0, new Buffer(250), {onComplete: output });
          break;
      }

      break;

    case 'reset':
      port.reset()
        .then(function() { exit(0);})
        .catch( function(e) { console.log( e); exit(1); } );
      break;

    case 'command':
      if( port.commands.indexOf( args._[1] ) < 0 ) {
        console.error(chalk.red( 'Unknown Command ' + action ));
        exit(1);
      }

      var buf = argsToByteBuf( args._, 2 );

      port.command( args._[1], buf )
        .then(function(response) { console.log(response.toString()); exit(0);})
        .catch( function(e) { console.log( e); exit(1); } );
      break;

    default:
      break;
  }

});

// port errors
port.on('error', function( err ) {
  console.error( chalk.underline.bold( err.message ));
  exit(1);
});

// Hook events for verbose output
if( args.v ) {


  var connection = port.master.getConnection();

  connection.on('open', function()
  {
    console.log( chalk.green('[connection#open]'));
  });

  connection.on('close', function()
  {
    console.log(chalk.green('[connection#close]'));
  });

  connection.on('error', function(err)
  {
    console.log(chalk.red('Error: ', '[connection#error] ' + err.message));
    exit(1);
  });

  connection.on('write', function(data)
  {
    if( isAscii ) {
      console.log(chalk.green('[connection#write] ' + data.toString()));
    }
    else {
      console.log(chalk.green('[connection#write] '), data );
    }


  });

  connection.on('data', function(data)
  {
    if( isAscii ) {
      console.log(chalk.green('[connection#data] ' + data.toString()));
    }
    else {
      console.log(chalk.green('[connection#data] %d ' ),data.length, data );
    }
  });

}

/**
 * Cleanup and terminate the process
 *
 * @param  {[type]} code [description]
 * @return {[type]}      [description]
 */
function exit(code ) {
  port.destroy();
  process.exit(code);
}

if( args.v ) {
  console.log( 'Opening ' + config.port.name );
}
// Open the port
// the 'open' event is triggered when complete
port.open(function(err) {
  if( err ) {
    console.log(err);
    exit(1);
  }
});

