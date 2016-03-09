var express = require('express');
var router = express.Router();
var async = require('async');
var gcm = require('node-gcm');

var user;
var message;
var receivers;

exports.set = function(sender, receiver, msg) {
   user = sender;
   receivers = receiver
   message = msg || "공감하였습니다!";
}

exports.push = function() {
   //커넥션
   function getConnection(callback) {
      pool.getConnection(function(err, connection) {
         if(err) {
            callback(err);
         } else {
            callback(null, connection);
         }
      })
   }
   //select Iparty
   function selectIparty(connection, callback) {

      var select = "select registration_token, date_format(CONVERT_TZ(now(),'+00:00','+9:00'),'%Y-%m-%d %H:%i:%s') as time " +
         "from greendb.iparty "+
         "where nickname = ?";
      connection.query(select, [receivers], function(err, results) {
         connection.release();
         if(err) {
            callback(err);
         } else {
            callback(null, results[0]);
         }
      });
   }
   //
   function sendMessage(info, callback) {

      var server_access_key = "AIzaSyADRF0g8ms7lVksTmV8L0Ln5r76eMGdaS8";
      var sender = new gcm.Sender(server_access_key);
      var registrationIds = [];
      registrationIds.push(info.registration_token);

      var message = new gcm.Message({
         "collapseKey": 'demo',
         "delayWhileIdle": true,
         "timeToLive": 3,
         "data" : {
            "who": user,
            "message": message,
            "date": info.time
         }
      });

      sender.send(message, registrationIds, 4, function(err, result) {
         if(err) {
            next(err);
         } else {
            console.log(result);
         }
      });

      callback(null);
   }

   async.waterfall([getConnection, selectIparty, sendMessage], function(err) {
      if(err) {
         return false;
      } else {
         return true;
      }
   });
}