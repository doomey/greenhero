var express = require('express');
var router = express.Router();
var async = require('async');
var bell = require('./bell');
var logger = require('./logger');


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
    //db에서 select
    var page = parseInt(req.query.page);
    page = (isNaN(page))? 1 : page;
    page = (page < 1)? 1 : page;

    var limit = 10;
    var offset = parseInt((page - 1) * 10);

    function selectGreenspace(connection, callback) {
        var sql = "SELECT e.id as id, e.title as title, e.heart as heart, ifnull(r.rAmount,0) as rAmount, b.photourl as backgroundUrl, " +
            "e.content as content, p.photourl as photourl " +
            "FROM e_diary e left join (select ediary_id, count(ediary_id) as rAmount from reply group by ediary_id) r on (e.id = r.ediary_id) " +
            "left join (select refer_id, photourl from photos where refer_type = 1) p on (e.id = p.refer_id) " +
            "left join (select refer_id, photourl from photos where refer_type = 4) b on (e.background_id = b.refer_id) " +
            "order by id desc limit ? offset ?";
        connection.query(sql, [limit, offset], function (err, results) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                callback(null, results)
            }
        });
    };


    async.waterfall([getConnection, selectGreenspace], function (err, results) {
        if (err) {
            var err ={
                "code" : "err008",
                "message" : "GREEN SPACE 목록을 불러올 수 없습니다."
            };
            logger.log('error', err);
            next(err);
        } else {
            var list = [];
            for(var i = 0; i< results.length; i++){
                list.push({
                    "id" : results[i].id,
                    "title": results[i].title,
                    "heart": results[i].heart,
                    "rAmount": results[i].rAmount,
                    "backgroundUrl": results[i].backgroundUrl,
                    "photoUrl": results[i].photourl
                });
            }
            var result = {
                "result": {
                    "page": page,
                    "listPerPage": limit,
                    "list": list
                }
            };
            res.json(result);
        }

    });


});

router.get('/:ediaryId', function(req, res, next) {
    // db에서 select
    var ediaryId = parseInt(req.params.ediaryId);
    var h_diary_id;
    var iparty_id;
    if(req.user === undefined) {
        iparty_id = null;
        h_diary_id = null;
    } else {
        iparty_id = req.user.id;
        h_diary_id = ediaryId;
    }

    function selectGreenspace(connection, callback) {
        var sql = "SELECT i.nickname as nickname, ifnull(r.rAmount,0) as rAmount, b.photourl as backgroundUrl, " +
            "date_format(CONVERT_TZ(e.wdatetime, \'+00:00\', \'+9:00\'), \'%Y-%m-%d %H:%i:%s\') as wtime," +
            "e.content as content, p.photourl as photourl, " +
            "case when (select id from heart where iparty_id = ? and e_diary_id = ?) then true else false end as onheart " +
            "FROM e_diary e left join (select id, nickname from iparty) i on(e.iparty_id = i.id) " +
                           "left join (select ediary_id, count(ediary_id) as rAmount from reply group by ediary_id) r on (e.id = r.ediary_id) " +
                           "left join (select refer_id, photourl from photos where refer_type = 1) p on (e.id = p.refer_id) " +
                           "left join (select refer_id, photourl from photos where refer_type = 4) b on (e.background_id = b.refer_id) " +
            "where e.id = ?";
        connection.query(sql, [iparty_id, h_diary_id, ediaryId], function (err, results) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                callback(null, connection, results)
            }
        });
    };



    function resentGreenspace(connection, results, callback) {
        var sql = "SELECT e.id as id, e.title as title, " +
            "b.photourl as backgroundUrl, " +
            "p.photourl as thumbnail " +
            "FROM e_diary e join (select id, nickname from iparty) i on(e.iparty_id = i.id) " +
            "left join (select refer_id, photourl from photos where refer_type = 1) p on (e.id = p.refer_id) " +
            "left join (select refer_id, photourl from photos where refer_type = 4) b on (e.background_id = b.refer_id) " +
            "order by id desc limit 6 offset 0";
        connection.query(sql, function (err, resent) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                results.newest = resent;
                callback(null, results);
            }
        });
    }

    async.waterfall([getConnection, selectGreenspace, resentGreenspace], function (err, results) {
        if (err) {
            var err ={
                "code" : "err009",
                "message" : "GREEN SPACE 상세를 불러올 수 없습니다."
            };
            logger.log('error', err);
            next(err);
        } else {
            if(results.length===0){
                var err ={
                    "code" : "err009",
                    "message" : "GREEN SPACE 상세를 불러올 수 없습니다."
                };
                logger.log('error', err);
                next(err);
            } else {
                var list = {
                    "nickname": results[0].nickname,
                    "wtime": results[0].wtime,
                    "content": results[0].content,
                    "rAmount" : results[0].rAmount,
                    "backgroundUrl": results[0].backgroundUrl,
                    "photoUrl": results[0].photourl,
                    "onheart" : results[0].onheart
                };
                var result = {
                    "result": {
                        "list": [list],
                        "newest" : results.newest
                    }
                };
                res.json(result);
            }

        }

    });

});


router.get('/searching', function(req, res, next) {
    var page = parseInt(req.query.page);
    page = (isNaN(page))? 1 : page;
    page = (page < 1)? 1 : page;

    var limit = 10;
    var offset = parseInt((page - 1) * 10);

    var search = "%"+req.query.search+"%";
    var type = req.query.type;

    function selectGreenspace(connection, callback) {
        if(type === "title") {
            var sql = "SELECT e.id as id, e.title as title, i.nickname as nickname, date_format(CONVERT_TZ(e.wdatetime, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as wtime, e.heart as heart, ifnull(r.rAmount,0) as rAmount, b.path as backgroundUrl, e.content as content, p.photourl as photourl "+
                "FROM e_diary e join (select id, nickname "+
                "from iparty) i "+
                "on(e.iparty_id = i.id) "+
                "left join (select ediary_id, count(ediary_id) as rAmount "+
                "from reply "+
                "group by ediary_id) r "+
                "on (e.id = r.ediary_id) "+
                "left join (select refer_id, photourl "+
                "from photos "+
                "where refer_type = 1) p "+
                "on (e.id = p.refer_id) "+
                "left join (select id, path "+
                "from background) b "+
                "on(e.background_id = b.id) "+
                "where e.title like ? "+
                "order by id desc limit ? offset ?";
            connection.query(sql, [search, limit, offset], function (err, space) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    callback(null, space)
                }
            });
        }

        if(type === "body") {
            var sql = "SELECT e.id as id, e.title as title, i.nickname as nickname, date_format(CONVERT_TZ(e.wdatetime, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as wtime, e.heart as heart, ifnull(r.rAmount,0) as rAmount, b.path as backgroundUrl, e.content as content, p.photourl as photourl "+
                "FROM e_diary e join (select id, nickname "+
                "from iparty) i "+
                "on(e.iparty_id = i.id) "+
                "left join (select ediary_id, count(ediary_id) as rAmount "+
                "from reply "+
                "group by ediary_id) r "+
                "on (e.id = r.ediary_id) "+
                "left join (select refer_id, photourl "+
                "from photos "+
                "where refer_type = 1) p "+
                "on (e.id = p.refer_id) "+
                "left join (select id, path "+
                "from background) b "+
                "on(e.background_id = b.id) "+
                "where e.content like ? "+
                "order by id desc limit ? offset ?";
            connection.query(sql, [search, limit, offset], function (err, space) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    callback(null, space)
                }
            });
        }

        if(type === "nickname") {
            var sql = "SELECT e.id as id, e.title as title, i.nickname as nickname, date_format(CONVERT_TZ(e.wdatetime, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as wtime, e.heart as heart, ifnull(r.rAmount,0) as rAmount, b.path as backgroundUrl, e.content as content, p.photourl as photourl "+
                "FROM e_diary e join (select id, nickname "+
                "from iparty) i "+
                "on(e.iparty_id = i.id) "+
                "left join (select ediary_id, count(ediary_id) as rAmount "+
                "from reply "+
                "group by ediary_id) r "+
                "on (e.id = r.ediary_id) "+
                "left join (select refer_id, photourl "+
                "from photos "+
                "where refer_type = 1) p "+
                "on (e.id = p.refer_id) "+
                "left join (select id, path "+
                "from background) b "+
                "on(e.background_id = b.id) "+
                "where i.nickname like ? "+
                "order by id desc limit ? offset ?";
            connection.query(sql, [search, limit, offset], function (err, space) {
                connection.release();
                if (err) {
                    callback(err);
                } else {
                    callback(null, space)
                }
            });
        }
    }

    async.waterfall([getConnection, selectGreenspace], function (err, results) {
        if (err) {
            var err ={
                "code" : "err008",
                "message" : "GREEN SPACE 목록을 불러올 수 없습니다."
            };
            logger.log('error', err);
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
                    "list": list
                }
            };
            res.json(result);
        }

    });


});

/* GET home page. */
router.get('/:ediaryId/replies', function(req, res, next) {
    var e_id = parseInt(req.params.ediaryId);
    var page = parseInt(req.query.page);
    page = (isNaN(page))? 1 : page;
    page = (page < 1)? 1 : page;
    var limit = 10;
    var offset = parseInt((page - 1) * 10);



    function selectReview(connection, callback) {
        var sql = "SELECT r.id, r.body, r.iparty_id, date_format(CONVERT_TZ(r.wdatetime, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as 'wtime', i.nickname " +
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
                "code" : "err010",
                "message" : "댓글 목록을 불러올 수 없습니다."
            }
            logger.log('error', err);
            next(err);
        } else {
            var list = [];
            for(var i = 0; i< results.length; i++){
                if(req.isAuthenticated()){
                    if(req.user.id === results[i].iparty_id){
                        list.push({
                            "id" : results[i].id,
                            "body": results[i].body,
                            "wtime": results[i].wtime,
                            "nickname" : results[i].nickname,
                            "login" : true
                        });
                    } else {
                        list.push({
                            "id" : results[i].id,
                            "body": results[i].body,
                            "wtime": results[i].wtime,
                            "nickname" : results[i].nickname,
                            "login" : false
                        });
                    }
                } else {
                    list.push({
                        "id" : results[i].id,
                        "body": results[i].body,
                        "wtime": results[i].wtime,
                        "nickname" : results[i].nickname,
                        "login" : false
                    });
                }
            }

            res.json({
                "result" : {
                    "ediaryId" : e_id,
                    "page" : page,
                    "listPerPage" : limit,
                    "list" : list
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
    var receiver;
    var exceed = 0;

    function selectWriter(connection, callback){
        var sql = "select i.nickname as inick " +
                  "from e_diary e join iparty i on (i.id = e.iparty_id) " +
                  "where e.id = ?";
        connection.query(sql, [ediary_id], function(err, results){
            if (err) {
                connection.release();
                callback(err);
            } else {

                receiver = results[0].inick;
                //console.log('리시버' + receiver);
                callback(null, connection);
            }
        })
    }

    function insertReply(connection, callback) {
        var sql = "insert into reply (body, wdatetime, ediary_id, iparty_id) " +
            "values (?, now(), ?, ?)";
        connection.query(sql, [body, ediary_id, iparty_id], function (err, result) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                replyId = result.insertId;
                logger.log('debug', '생성된 댓글 ID :' + replyId);
                logger.log('debug', '생성된 댓글 내용 : ' + body);
                logger.log('debug', '생성된 댓글이 속한 게시글 : ' + ediary_id);
                logger.log('debug', '댓글 작성한 사람 : ' + iparty_id);
                //console.log('댓글ID : ' + replyId + ', 댓글 내용 : ' + body);
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
                        var sql = "select sum(changedamount) as tLeaf " +
                            "from leafhistory " +
                            "where leaftype = 2 and iparty_id = ? and to_days(date_format(CONVERT_TZ(applydate, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s')) = " +
                            "                                         to_days(date_format(CONVERT_TZ(now(), '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s'))";
                        connection.query(sql, [iparty_id], function (err, results) {
                            if (err) {
                                connection.release();
                                callback(err);
                            } else {
                                tLeaf = results[0].tLeaf;
                                logger.log('info', req.user.nickname+"님 오늘 획득 한 총 나뭇잎 개수 : " + tLeaf);
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
                            //connection.release();
                            //var err = {"message": "오늘의 나뭇잎 충전량을 초과하였습니다."};
                            //next(err);
                            exceed = 1;
                            callback(null);
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
                                    logger.log('info', "생성된 leaf_ID : " + leafId);
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
                                logger.log('info', req.user.nickname+"님의 총 나뭇잎 개수 " + userLeaf);
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
                                logger.log('info', "업데이트가 완료되었습니다.");
                                callback(null);
                            }
                        });
                    }
                }

                async.series([selectTodayLeaf, insertLeaf, selectUserLeaf, updateUserLeaf], function(err, result) {
                    if(err) {
                        logger.log('error', err);
                        callback(err);
                    } else {
                        bell.set(req.user.nickname, receiver, "reply", ediary_id);
                        bell.push();
                        callback(null, result);
                    }
                });


            }
        });
    }

    async.waterfall([getConnection, selectWriter, insertReply, insertMystory], function (err, results) {
        if (err) {
            var err = {
                "code" : "err011",
                "message" : "댓글을 작성할 수 없습니다."
            }
            logger.log('error', err);
            next(err);
        } else if (exceed) {
            res.json({
                "result" : {
                    "message" : "댓글은 작성하셨지만 충전량을 초과했기 때문에 적립하지는 않았습니다."
                }
            });
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
});


router.put('/:ediaryId/replies/:replyId', isLoggedIn, function(req, res, next) {
    var reply_id = req.params.replyId;
    var body = req.body.replyBody;
    var ediary_id = req.params.ediaryId;


    function compareUser(connection, callback) {
        var sql = "SELECT * FROM reply " +
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
                "code" : "err012",
                "message" : "댓글을 수정할 수 없습니다."
            };
            logger.log('error', err);
            next(err);
        } else {
            res.json(result);
        }
    })

});

module.exports = router;
