var express = require('express');
var url = require('url');
var router = express.Router();
var queryString = require('querystring');
var async = require('async');

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
    var page = urlQuery.page;
    var limit = 10;
    var offset = (page - 1) * 10;

    function selectArticles(connection, callback){
        var sql = "select e.id as eid, e.title, e.cname, e.sdate, e.edate, e.content, " +
                  "f.modifiedfilename as mo, f.filetype as type " +
                  "from epromotion e join files f on (f.refer_id = e.id) and (refer_type = 2) " +
                  "order by eid, type limit ? offset ?";
        connection.query(sql, [limit, offset], function(err,results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    callback(null, results);
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
            var list = [];
            var modifiedList = [];
            for(var i=0;i<result.length;i++){
                    list.push({
                        "epId" : result[i].eid,
                        "title" : result[i].title,
                        "thumbnail" : "/public/photos/" + result[i].mo,
                        "epName" : result[i].cname,
                        "sDate" : result[i].sdate,
                        "eDate" : result[i].edate,
                        "content" : result[i].content,
                        "file" : "/public/multimedias/" + result[i].mo
                    });
            }

            for(var i=0;i<result.length;i++) {
                if(i%2==1){
                    list[i-1].file = "/public/photos/" + result[i].mo;
                    modifiedList.push(list[i-1]);
                }
            }

            res.json({
                "result" : {
                    "page" : page,
                    "listPerPage" : limit,
                    "list" : modifiedList
                }
            });
        }
    });
});

router.post('/', function(req, res, next){
    var watch = req.body.watch;
    var iparty_id = parseInt(req.body.ipartyId);
    var userLeaf = 0;
    var tLeaf = 0;

    if(watch == 1){
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
                    "code" : "err014",
                    "message" : "시청 완료 메시지가 들어오지 않았습니다."
                }
                next(err);
            } else {
                res.json({
                    "result" : {
                        "message" : "시청 완료 메시지가 들어왔습니다. 나뭇잎 적립 절차를 진행합니다."
                    }
                });
            }
        });
    } else {
        console.log('실패 : ' + watch);
    }
});

module.exports = router;