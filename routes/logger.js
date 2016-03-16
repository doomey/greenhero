var winston = require('winston');
var DailyRotateFile = require('winston-daily-rotate-file');
var path = require('path');

var config = {
  transports: [
    new winston.transports.Console({
      level: 'error',
      json: false
    }),
    new DailyRotateFile({
      name: 'warnLogger',
      level: 'warn',
      filename: path.join(__dirname, '../logging/warn-'),
      datePattern: 'yyyy-MM-dd_HH.log',
      json: false,
      maxsize: 1024*1024
    }),
    new DailyRotateFile({
      name: 'debugLogger',
      level: 'debug',
      filename: path.join(__dirname, '../logging/debug-'),
      datePattern: 'yyyy-MM-dd_HH.log',
      json: false,
      maxsize: 1024*1024
    })
  ]
};

var logger = new winston.Logger(config);

module.exports = logger;