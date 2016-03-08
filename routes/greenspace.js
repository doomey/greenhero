var express = require('express');
var router = express.Router();
var async = require('async');
var bell = require('./bell');




function  getConnection (callback) {
    pool.getConnection(function (err, connection) {
        if (err) {
            var err = "connection 에러가 발생하였습니다.";
            callback(err) ;
        } else {
            callback(null, connection);
        }
    });
}

function isLoggedIn(req, res, next) {
    if(!req.isAuthenticated()) {
        var err = new Error('로그인이 필요합니다...');
        err. status = 401;
        next(err);
    } else {
        next(null, {"message" : "로그인이 완료되었습니다..."});
    }
}



router.get('/', function(req, res, next) {
    //todo 1 : db에서 select
   var page = parseInt(req.query.page);
   page = (isNaN(page))? 1 : page;
   page = (page < 1)? 1 : page;

    var limit = 10;
    var offset = parseInt((page - 1) * 10);

    function selectGreenspace(connection, callback) {
        var sql = "SELECT e.id as id, e.title as title, i.nickname as nickname, date_format(CONVERT_TZ(e.wdatetime, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as wtime, e.heart as heart, ifnull(r.rAmount,0) as rAmount, b.path as backgroundUrl, e.content as content, p.photourl as photourl " +
            "FROM e_diary e join (select id, nickname " +
            "from iparty) i " +
            "on(e.iparty_id = i.id) " +
            "left join (select ediary_id, sum(ediary_id) as rAmount " +
            "from reply " +
            "group by ediary_id) r " +
            "on (e.id = r.ediary_id) " +
            "left join (select refer_id, photourl " +
            "from photos " +
            "where refer_type = 1) p " +
            "on (e.id = p.refer_id) " +
            "left join (select id, path " +
                       "from background) b " +
            "on(e.background_id = b.id) " +
            "order by id desc limit ? offset ?";
        connection.query(sql, [limit, offset], function (err, space) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                callback(null, connection, space)
            }
        });
    };

    function resentGreenspace(connection, results, callback) {
        var sql = "SELECT e.id, e.title, p.photourl as thumbnail , b.path as backgroundUrl " +
                  "FROM e_diary e join (select id, nickname " +
                                       "from iparty) i " +
                                 "on(e.iparty_id = i.id) " +
                                 "left join (select ediary_id, sum(ediary_id) as rAmount " +
                                            "from reply " +
                                 "group by ediary_id) r " +
                                 "on (e.id = r.ediary_id) " +
                                 "left join (select refer_id, photourl " +
                                            "from photos " +
                                            "where refer_type = 1) p " +
                                       "on (e.id = p.refer_id) " +
                                 "left join (select id, path " +
                                 "from background) b " +
                                 "on(e.background_id = b.id) " +
                                 "order by id desc limit 6 offset 0";
        connection.query(sql, function (err, resent) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                results.newest = resent;
                callback(null, results);
                console.log(results);
            }
        });
    }



    async.waterfall([getConnection, selectGreenspace, resentGreenspace], function (err, results) {

        if (err) {
            var err ={
                "code" : "err006",
                "message" : "GREEN SPACE 을(를) 불러올 수 없습니다."
            };
            next(err);
        } else {
            var list = [];
            for(var i = 0; i< results.length; i++){
                list.push({
                    "id" : results[i].id,
                    "title": results[i].title,
                    "nickname": results[i].nickname,
                    "wtime": results[i].wtime,
                    "heart": results[i].heart,
                    "rAmount": results[i].rAmount,
                    "backgroundUrl": results[i].backgroundUrl,
                    "content": results[i].content,
                    "photoUrl": results[i].photourl
                });
            }
            var result = {
                "result": {
                    "page": page,
                    "listPerPage": limit,
                    "list": list,
                    "newest" : results.newest
                }
            };
            res.json(result);
        }

    });


});

/* GET home page. */
router.get('/:ediaryId/replies', function(req, res, next) {
    //var urlObj = url.parse(req.url).query;
    //var urlquery = queryString.parse(urlObj);
    var e_id = parseInt(req.params.ediaryId);
    var page = req.query.page;
    var limit = 10;
    var offset = parseInt((page - 1) * 10);

    console.log(req.query.page);



  function selectReview(connection, callback) {
    var sql = "SELECT r.id, r.body, date_format(CONVERT_TZ(r.wdatetime, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as 'wtime', i.nickname " +
              "from reply r join (select id, nickname " +
                                 "from iparty) i " +
                           "on(r.iparty_id = i.id) " +
              "where ediary_id = ? " +
              "limit ? offset ?";
    connection.query(sql, [e_id, limit, offset], function (err, results) {
        connection.release();
      if (err) {
          callback(err);
      } else {
          callback(null, results);
      }
    });
  }

  async.waterfall([getConnection, selectReview], function (err, results){
      if(err) {
          var err = {
                  "code" : "err007",
                  "message" : "댓글을 불러올 수 없습니다."
          }
          next(err);
      } else {
          res.json(
              { "result" : {
                  "ediaryId" : e_id,
                  "page" : page,
                  "listPerPage" : limit,
                  "list" : results
              }

              });
      }
  })
});


router.post('/:ediaryId/replies', isLoggedIn, function(req, res, next) {
    var ediary_id = parseInt(req.params.ediaryId);
    var body = req.body.replyBody;
    var iparty_id = parseInt(req.user.id);
    var tLeaf = 0;
    var userLeaf = 0;
    var replyId = 0;


    function insertReply(connection, callback) {
        var sql = "insert into reply (body, wdatetime, ediary_id, iparty_id) " +
            "values (?, now(), ?, ?)";
        connection.query(sql, [body, ediary_id, iparty_id], function (err, result) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                replyId = result.insertId;
                console.log(replyId);
                callback(null, connection);
            }
        });
    }

    function insertMystory(connection, callback) {
        connection.beginTransaction(function (err) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                function selectTodayLeaf(callback) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                                //todo 6 : 오늘 획득한 나뭇잎을 조회한다.
                        var sql = "select sum(changedamount) as tLeaf " +
                                    "from leafhistory " +
                                    "where date(applydate) = date(now()) and iparty_id = ? and leaftype = 2";
                        connection.query(sql, [iparty_id], function (err, results) {
                            if (err) {
                                connection.release();
                                callback(err);
                            } else {
                                tLeaf = results[0].tLeaf;
                                console.log("오늘 획득 한 총 나뭇잎 개수 : " + tLeaf);
                                callback(null, tLeaf);
                            }
                        });


                    }
                }

                function insertLeaf(callback) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        if (tLeaf >= 10) {
                            connection.release();
                            var err = {"message": "오늘의 나뭇잎 충전량을 초과하였습니다."};
                            next(err);
                        } else {
                            var sql = "insert into leafhistory (applydate, leaftype, changedamount, iparty_id) " +
                                "values (now(), 2, 1, ?)";
                            connection.query(sql, [iparty_id], function (err, result) {
                                if (err) {
                                    connection.rollback();
                                    connection.release();
                                    callback(err);
                                } else {
                                    var leafId = result.insertId;
                                    console.log("생성된 leaf_ID : " + leafId);
                                    callback(null);
                                }


                            });
                        }
                    }
                }

                function selectUserLeaf(callback) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        var sql = "select sum(changedamount) as tLeaf " +
                                  "from leafhistory " +
                                  "where iparty_id = ?";
                        connection.query(sql, [iparty_id], function (err, result) {
                            if (err) {
                                connection.release();
                                callback(err);
                            } else {
                                userLeaf = result[0].tLeaf;
                                console.log("사용자의 총 나뭇잎 개수 " + userLeaf);
                                callback(null);
                            }
                        })
                    }

                }

                function updateUserLeaf(callback) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        var sql = "update iparty " +
                                  "set totalleaf = ? " +
                                  "where id = ?";
                        connection.query(sql, [userLeaf, iparty_id], function (err, result) {
                            if (err) {
                                connection.rollback();
                                connection.release();
                                callback(err);
                            } else {
                                connection.commit();
                                connection.release();
                                console.log("업데이트가 완료되었습니다.");
                                callback(null);
                            }
                        });
                    }
                }

                async.series([selectTodayLeaf, insertLeaf, selectUserLeaf, updateUserLeaf], function(err, result) {
                    if(err) {
                        callback(err);
                    } else {
                        callback(null, result);
                    }
                });


            }
        });
    }

    async.waterfall([getConnection, insertReply, insertMystory], function (err, results) {
        if(err){
            var err = {
                "code" : "err008",
                "message" : "댓글을 작성할 수 없습니다."
            }
            next(err);
        } else {
            var results = {
                "result" : {
                    "replyId" : replyId,
                    "message" : "댓글이 작성되었습니다."
                }
            }
            res.json(results);
        }
    })

    bell.setMessage('님이 댓들을 다셨습니다.');

});


router.put('/:ediaryId/replies/:replyId', isLoggedIn, function(req, res, next) {
    var reply_id = req.params.replyId;
    var body = req.body.replyBody;
    var ediary_id = req.params.ediaryId;


    function compareUser(connection, callback) {
        var sql = "SELECT * FROM greendb.reply " +
                  "where iparty_id = ? and ediary_id = ? and id = ?";
        connection.query(sql, [req.user.id, ediary_id, reply_id], function (err, results) {
            if(err) {
                callback(err);
            } else {
                if(results.length === 0) {
                    var err = new Error("글을 수정할 권한이 없습니다.");
                    next(err);
                } else {
                    callback(null, connection);
                }
            }
        })
    }


    function updateReply(connection, callback) {
        var sql = "update reply " +
                  "set body = ?, wdatetime = now() " +
                  "where iparty_id = ? and ediary_id = ? and id = ?";
        connection.query(sql, [body, req.user.id, ediary_id, reply_id], function (err, result) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                callback(null, {
                    "message" : "수정이 완료되었습니다."
                })
            }
        });
    }

    async.waterfall([getConnection, compareUser, updateReply], function (err, result) {
        if (err) {
            var err = {
                    "code" : "err009",
                    "message" : "댓글을 수정할 수 없습니다."
            }
            next(err);
        } else {
            res.json(result);
        }
    })

});

module.exports = router;
