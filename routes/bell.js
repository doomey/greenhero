var express = require('express');
var router = express.Router();
var async = require('async');
var gcm = require('node-gcm');

var user;
var inputMessage;
var receivers;
var type;
var articleid;
var noti;

exports.set = function(sender, receiver, inputType, id) {
   type = inputType;
   user = sender;
   receivers = receiver;
   articleid = id;

   if(inputType === "sympathy") {
      noti = {
         title: '공감이 되었습니다.',
         body: user + "님이 공감하였습니다!",
         icon: 'pushLike' //안드로이드 리소스에 집어넣을것
      };
   }
   else if(inputType === "reply") {
      noti = {
         title: '댓글이 달렸습니다.',
         body: user + "님이 댓글을 남겼습니다!",
         icon: 'pushComment'
      };
   }
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
         "from iparty "+
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

      var message = new gcm.Message({
         "collapseKey": 'demo',
         "delayWhileIdle": true,
         "timeToLive": 3,
         "data" : {
            "type" : type,
            "articleId" : articleid,
            "who": user,
            "message": inputMessage,
            "date": info.time
         }
      });

      message.addNotification(noti);

      var server_access_key = "AIzaSyADRF0g8ms7lVksTmV8L0Ln5r76eMGdaS8";
      var sender = new gcm.Sender(server_access_key);
      var registrationIds = [];
      registrationIds.push(info.registration_token);

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