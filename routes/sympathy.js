var express = require('express');
var router = express.Router();
var async = require('async');
var bell = require('./bell');
var logger = require('./logger');

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
   //공감을 한번 누르면 heart가 1 증가하고 다시 한번 공감을 누르면 공감이 취소되어 heart가 1 감소한다.
   //공감 누를때 회원id와 글 id를 heart테이블에 넣기 id, iparty_id, e_diary 컬럼. insert
   function doHeart(connection, callback) {
      var ediaryId = parseInt(req.body.ediaryId);
      var onheart = parseInt(req.body.onheart);

      if(onheart === 1) {
         //heart테이블에 insert
         var insert = "insert into heart(iparty_id, e_diary_id) "+
            "values(?, ?)";
         connection.query(insert, [req.user.id, ediaryId], function(err, result) {
            if(err) {
               connection.release();
               err.message = "heart 테이블에 정보를 저장하는 중 오류가 발생하였습니다.";
               logger.log('error', req.user.nickname+"님 " + err.message);
               callback(err);
            }
      });

         //하트를 1 증가시키고 푸쉬 메시지
         var select = "SELECT e.id as id, e.heart as heart, i.nickname as nickname "+
            "FROM e_diary e join iparty i on (e.iparty_id = i.id) "+
            "where e.id = ?";
         connection.query(select, [ediaryId], function(err, results) {
            if(err) {
               connection.release();
               callback(err);
            } else {
               var update = "update e_diary "+
                  "set heart = ? "+
                  "where id = ?";
               connection.query(update, [results[0].heart + 1, results[0].id], function(err, result) {
                  if(err) {
                     callback(err);
                  } else {
                     //push
                     bell.set(req.user.nickname, results[0].nickname, "sympathy", results[0].id);
                     if(bell.push() === true) {
                        callback(null,
                           {
                              "result" : {
                                 "onheart" : 0,
                                 "heart" : results[0].heart + 1,
                                 "message" : results[0].nickname+"님에게 공감하였습니다."
                              }
                           });
                     } else {
                        callback(null,
                           {
                              "result" : {
                                 "message" : results[0].nickname+"님께 공감메시지를 전송하지 못하였습니다.."
                              }
                           });
                     }
                  }
               });
            }
         });
      } else {
         //heart테이블에 insert
         var deleteSql = "delete from heart "+
            "where iparty_id = ? and e_diary_id = ?";
         connection.query(deleteSql, [req.user.id, ediaryId], function(err, result) {
            if(err) {
               connection.release();
               err.message = "heart테이블에 정보를 삭제하던 중 오류가 발생하였습니다.";
               'error', req.user.nickname+"님 "+err.message
               callback(err);
            }
         });

         //하트를 0 감소시키고 푸쉬 메시지
         var select = "SELECT e.id as id, e.heart as heart, i.nickname as nickname "+
            "FROM e_diary e join iparty i on (e.iparty_id = i.id) "+
            "where e.id = ?";
         connection.query(select, [ediaryId], function(err, results) {
            if(err) {
               connection.release();
               callback(err);
            } else {
               var update = "update e_diary "+
                  "set heart = ? "+
                  "where id = ?";
               connection.query(update, [results[0].heart - 1, results[0].id], function(err, result) {
                  if(err) {
                     callback(err);
                  } else {
                     //push
                     bell.set(req.user.nickname, results[0].nickname, "unsympathy", results[0].id);
                     if(bell.push() === true) {
                        callback(null,
                           {
                              "result" : {
                                 "onheart" : 1,
                                 "heart" : results[0].heart - 1,
                                 "message" : results[0].nickname+"님이 공감을 취소하였습니다."
                              }
                           });
                     } else {
                        callback(null,
                           {
                              "result" : {
                                 "message" : results[0].nickname+"님께 공감 취소 메시지를 전송하지 못하였습니다.."
                              }
                           });
                     }
                  }
               });
            }
         });
      }

   }

   async.waterfall([getConnection, doHeart], function(err, message) {
      if(err) {
         err.code = "err010";
         logger.log('error', req.user.nickname + '님이 ' + err.message);
         next(err);
      } else {
         res.json(message);
      }
   })
});

module.exports = router;