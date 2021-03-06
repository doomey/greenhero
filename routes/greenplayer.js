var express = require('express');
var url = require('url');
var router = express.Router();
var async = require('async');
var passport = require('passport');
var logger = require('./logger');

function isLoggedIn(req, res, next) {
    if(!req.isAuthenticated()) {
        var err = new Error('로그인이 필요합니다...');
        err. status = 401;
        next(err);
    } else {
        next(null, {"message" : "로그인이 완료되었습니다..."});
    }
}

function getConnection(callback){
    pool.getConnection(function(err, connection){
        if(err){
            callback(err);
        } else {
            callback(null, connection);
        }
    });
}

router.get('/', function(req, res, next){
    var page = parseInt(req.query.page);
    page = isNaN(page) ? 1 : page;
    page = (page<1) ? 1 : page;
    var limit = 10;
    var offset = (page - 1) * limit;

    function selectArticles(connection, callback){
        var sql = "select e.id, e.title, e.cname, p.photourl " +
            "from epromotion e join photos p on (p.refer_type = 2 and p.refer_id = e.id) " +
            "order by e.id desc limit ? offset ?";
        connection.query(sql, [limit, offset], function(err, results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    var list=[];
                    async.eachSeries(results, function(result, callback){
                        list.push({
                            "epId" : result.id,
                            "title" : result.title,
                            "thumbnail" : result.photourl,
                            "epName" : result.cname
                        });
                        callback(null);
                    }, function(err){
                        if(err) {
                            callback(err);
                        } else {
                            callback(null, list);
                        }
                    });
                } else {
                    callback(err);
                }
            }
        });
    }

    async.waterfall([getConnection, selectArticles], function(err, result){
        if(err){
            var err = {
                "code" : "err018",
                "message" : "GREEN PLAYER 목록을 불러올 수 없습니다."
            }
            next(err);
        } else {
            res.json({
                "result" : {
                    "page" : page,
                    "listPerPage" : limit,
                    "list" : result
                }
            });
        }
    });
});

router.get('/:greenplayerId', function(req, res, next){
    var greenplayerId = req.params.greenplayerId;

    function selectArticles(connection, callback){
        var sql = "select date_format(CONVERT_TZ(e.sdate, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as 'GMT9sdate', " +
            "       date_format(CONVERT_TZ(e.edate, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as 'GMT9edate', " +
            "       e.content, e.fileurl " +
            "from epromotion e " +
            "where e.id = ?";
        connection.query(sql, [greenplayerId], function(err,results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    callback(null, {
                        "sDate" : results[0].GMT9sdate,
                        "eDate" : results[0].GMT9edate,
                        "content" : results[0].content,
                        "movie" : results[0].fileurl
                    });

                } else {
                    callback(err);
                }
            }
        });
    }
    //
    async.waterfall([getConnection, selectArticles], function(err, result){
        if(err){
            var err = {
                "code" : "err019",
                "message" : "GREEN PLAYER 상세를 불러올 수 없습니다."
            }
            next(err);
        } else {
            res.json({
                "result" : {
                    "list" : [result]
                }
            });
        }
    });
});

router.post('/', isLoggedIn, function(req, res, next){
    var watch = parseInt(req.body.watch);
    var iparty_id = parseInt(req.user.id);
    var userLeaf = 0;
    var tLeaf = 0;
    var exceed = 0;

    if(watch === 1){
        function leafTransaction(connection, callback) {
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
                                "where leaftype = 3 and iparty_id = ? and to_days(date_format(CONVERT_TZ(applydate, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s')) = " +
                                "      to_days(date_format(CONVERT_TZ(now(), '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s'))";
                            connection.query(sql, [iparty_id], function (err, results) {
                                if (err) {
                                    connection.release();
                                    callback(err);
                                } else {
                                    tLeaf = results[0].tLeaf;
                                    logger.log('info', "오늘 획득 한 총 나뭇잎 개수 : " + tLeaf);
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
                            if (tLeaf >= 20) {
                                //connection.release();
                                //var err = {"message": "오늘의 나뭇잎 충전량을 초과하였습니다."};
                                //next(err);
                                exceed = 1;
                                callback(null);
                            } else {
                                var sql = "insert into leafhistory (applydate, leaftype, changedamount, iparty_id) " +
                                    "values (now(), 3, 10, ?)";
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
                            var sql = "select ifnull((a.gained - b.used), 0) as tLeaf " +
                                      "from (select ifnull(sum(changedamount), 0) as gained, i.id " +
                                      "      from leafhistory h right join iparty i on (h.iparty_id = i.id) " +
                                      "      where leaftype != 0 and iparty_id = ?) a " +
                                      "join (select ifnull(sum(changedamount), 0) as used, i.id " +
                                      "      from leafhistory h right join iparty i on (h.iparty_id = i.id) " +
                                      "      where leaftype = 0 and iparty_id = ?) b " +
                                      "on (a.id = b.id)";
                            connection.query(sql, [iparty_id, iparty_id], function (err, result) {
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
                            callback(err);
                        } else {
                            callback(null, result);
                        }
                    });


                }
            });
        }

        async.waterfall([getConnection, leafTransaction], function (err, results) {
            if(err){
                logger.log('warn', '나뭇잎 적립 도중 오류');
                var err = {
                    "code" : "err020-1",
                    "message" : "메시지는 전송받았으나 나뭇잎 적립 도중 오류가 발생했습니다."
                }
                next(err);
            } else if (exceed) {
                logger.log('info', '충전량 초과');
                res.json({
                    "result" : {
                        "message" : "시청 완료 메시지가 정상적으로 들어왔지만 충전량을 초과했기 때문에 적립하지는 않았습니다."
                    }
                });
            } else {
                logger.log('info', req.user.nickname+'님 동영상 시청으로 나뭇잎 획득');
                res.json({
                    "result" : {
                        "message" : "시청 완료 메시지가 정상적으로 들어와서 나뭇잎을 적립했습니다."
                    }
                });
            }
        });
    } else {
        logger.log('info', 'watch에 1넣어서 전송하지 않음');
        var err = {
            "code" : "err020",
            "message" : "오늘의 나뭇잎 충전량을 초과하였습니다."
        }
        next(err);
    }
});

module.exports = router;
