var winston = require('winston');
var DailyRotateFile = require('winston-daily-rotate-file');

var logger = new winston.Logger(config);

var config = {
  transports: [
    new winston.transports.Console({
      level: 'error',
      json: false
    }),
    new DailyRotateFile({
      name: 'warnLogger',
      level: 'warn',
      filename: 'warn-',
      datePattern: 'yyyy-MM-dd_HH.log',
      json: false
    }),
    new DailyRotateFile({
      name: 'debugLooger',
      level: 'debug',
      filename: 'debug-',
      datePattern: 'yyyy-MM-dd_HH.log',
      json: false
    })
  ]
};

module.exports = logger;