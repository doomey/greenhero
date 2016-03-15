var express = require('express');
var router = express.Router();
var async = require('async');
var bell = require('./bell');

function isLoggedIn(req, res, next) {//
   if(!req.isAuthenticated()) {
      var err = new Error('로그인이 필요합니다...');
      err. status = 401;
      next(err);
   } else {
      next(null, {"message" : "로그인이 완료되었습니다..."});
   }
}

router.post('/', isLoggedIn, function(req, res, next) {
   //커넥션
   function  getConnection (callback) {
      pool.getConnection(function (err, connection) {
         if (err) {
            callback(err) ;
         } else {
            callback(null, connection);
         }
      });
   }
   //select greensapce
   function selectGreenspace(connection, callback) {
      var ediaryId = parseInt(req.body.ediaryId);

      var select = "SELECT e.id as id, e.heart as heart, i.nickname as nickname "+
                    "FROM e_diary e join iparty i on (e.iparty_id = i.id) "+
                    "where e.id = ?";
      connection.query(select, [ediaryId], function(err, results) {
         if(err) {
            connection.release();
            callback(err);
         } else {
            callback(null, results[0], connection);
         }
      });
   }
   //update greenspace
   function updateGreenspace(info, connection, callback) {
      var update = "update e_diary "+
                   "set heart = ? "+
                   "where id = ?";
      connection.query(update, [info.heart + 1, info.id], function(err, result) {
         connection.release();
         if(err) {
            callback(err);
         } else {
            //push
            bell.set(req.user.nickname, info.nickname, "sympathy", info.id);
            bell.push();
            callback(null,
                {
                   "result" : {
                     "message" : info.nickname+"님에게 공감하였습니다."
                   }
                });
         }
      });
   }

   async.waterfall([getConnection, selectGreenspace, updateGreenspace], function(err, message) {
      if(err) {
         var err = {
            "code" : "err010",
            "message" : "공감에 실패하였습니다."
         }
         next(err);
      } else {
         res.json(message);
      }
   })
});

module.exports = router;