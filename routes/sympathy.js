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
   //todo : 1. 공감 누를때 회원id와 글 id를 heart테이블에 넣기 id, iparty_id, e_diary 컬럼. insert
   function selectHeart(connection, callback) {
      var ediaryId = parseInt(req.body.ediaryId);

      var select = "select id "+
                   "from heart "+
                   "where iparty_id = ? and e_diary_id = ?";
      connection.query(select, [req.user.id, ediaryId], function(err, results) {
         if(err) {
            connection.release();
            err.message = "heart 테이블 조회 중 오류가 발생하였습니다.";
            logger.log('error', req.user.nickname+"님 " + err.message);
            callback(err);
         } else {
            if(!results.length) {
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
                     connection.query(update, [info.heart + 1, info.id], function(err, result) {
                        connection.release();
                        if(err) {
                           callback(err);
                        } else {
                           //push
                           bell.set(req.user.nickname, info.nickname, "sympathy", info.id);
                           if(bell.push() === true) {
                              callback(null,
                                 {
                                    "result" : {
                                       "onHeart" : true,
                                       "message" : info.nickname+"님에게 공감하였습니다."
                                    }
                                 });
                           } else {
                              callback(null,
                                 {
                                    "result" : {
                                       "message" : info.nickname+"님께 공감메시지를 전송하지 못하였습니다.."
                                    }
                                 });
                           }
                        }
                     });
                  }
               });
            } else {
               //heart테이블에 insert
               var deleteSql = "delete heart "+
                               "where iparty_id = ? and e_diary_id = ?";
               connection.query(deleteSql, [req.user.id, ediaryId], function(err, result) {
                  if(err) {
                     connection.release();
                     err.message = "heart테이블에 정보를 삭제하던 중 오류가 발생하였습니다.";
                     'error', req.user.nickname+"님 "+err.message
                     callback(err);
                  }
               });

               //하트를 1 감소시키고 푸쉬 메시지
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
                     connection.query(update, [info.heart - 1, info.id], function(err, result) {
                        connection.release();
                        if(err) {
                           callback(err);
                        } else {
                           //push
                           bell.set(req.user.nickname, info.nickname, "unsympathy", info.id);
                           if(bell.push() === true) {
                              callback(null,
                                 {
                                    "result" : {
                                       "onHeart" : false,
                                       "message" : info.nickname+"님이 공감을 취소하였습니다."
                                    }
                                 });
                           } else {
                              callback(null,
                                 {
                                    "result" : {
                                       "message" : info.nickname+"님께 공감 취소 메시지를 전송하지 못하였습니다.."
                                    }
                                 });
                           }
                        }
                     });
                  }
               });
            }

         }
      });
   }

   async.waterfall([getConnection, selectGreenspace, updateGreenspace], function(err, message) {
      if(err) {
         var err = {
            "code" : "err010",
            "message" : "공감에 실패하였습니다."
         }
         logger.log('error', req.user.nickname + '님이 ' + err);
         next(err);
      } else {
         res.json(message);
      }
   })
});

module.exports = router;