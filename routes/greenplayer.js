var express = require('express');
var url = require('url');
var router = express.Router();
var queryString = require('querystring');
var async = require('async');
var passport = require('passport');

function isLoggedIn(req, res, next) {//
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
    var urlObj = url.parse(req.url).query;
    var urlQuery = queryString.parse(urlObj);
    //var page = isNaN(urlQuery.page) || (urlQuery.page < 1) ? 1 : urlQuery.page;
    var page = parseInt(req.query.page);
    page = isNaN(page) ? 1 : page;
    page = (page<1) ? 1 : page;
    var limit = 10;
    var offset = (page - 1) * 10;

    function selectArticles(connection, callback){
        var sql = "select e.id, e.title, e.cname, " +
                  "date_format(CONVERT_TZ(e.sdate, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as 'GMT9sdate', " +
                  "date_format(CONVERT_TZ(e.edate, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as 'GMT9edate', " +
                  "e.content, e.fileurl, p.photourl " +
                  "from epromotion e join photos p on (p.refer_type=2 and p.refer_id = e.id) " +
                  "order by e.id desc limit ? offset ?";
        connection.query(sql, [limit, offset], function(err,results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    var list=[];
                    async.each(results, function(element, callback){
                        list.push({
                            "epId" : element.id,
                            "title" : element.title,
                            "thumbnail" : element.photourl,
                            "epName" : element.cname,
                            "sDate" : element.GMT9sdate,
                            "eDate" : element.GMT9edate,
                            "content" : element.content,
                            "movie" : element.fileurl
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
                "code" : "err013",
                "message" : "GREEN PLAYER 을(를) 불러올 수 없습니다."
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

router.post('/', isLoggedIn, function(req, res, next){
    var watch = parseInt(req.body.watch);
    var iparty_id = parseInt(req.user.id);
    var userLeaf = 0;
    var tLeaf = 0;

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
                                "where date(applydate) = date(now()) and iparty_id = ? and leaftype = 3";
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
                            if (tLeaf >= 20) {
                                connection.release();
                                var err = {"message": "오늘의 나뭇잎 충전량을 초과하였습니다."};
                                next(err);
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

        async.waterfall([getConnection, leafTransaction], function (err, results) {
            if(err){
                var err = {
                    "code" : "err014-1",
                    "message" : "메시지는 전송받았으나 나뭇잎 적립 도중 오류가 발생했습니다."
                }
                next(err);
            } else {
                res.json({
                    "result" : {
                        "message" : "시청 완료 메시지가 정상적으로 들어와서 나뭇잎을 적립했습니다."
                    }
                });
            }
        });
    } else {
        var err = {
            "code" : "err014",
            "message" : "시청 완료 메시지가 정상적으로 전송되지 않았으니 확인해 주세요."
        }
        next(err);
    }
});

module.exports = router;