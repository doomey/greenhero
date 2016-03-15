var express = require('express');
var async = require('async');
var router = express.Router();
var url = require('url');

router.get('/', function(req, res, next){
    var page = parseInt(req.query.page);
    page = isNaN(page) ? 1 : page;
    page = (page<1) ? 1 : page;
    var limit = 10;
    var offset = (page - 1) * 10;

    function getConnection(callback){
        pool.getConnection(function(err, connection){
            if(err){
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function selectArticles(connection, callback){
        var sql = "SELECT id, title, date_format(CONVERT_TZ(wdatetime, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as 'GMT9', board_id " +
            "FROM article " +
            "WHERE board_id = 2 " + //이용약관 : 2
            "order by id desc " +
            "LIMIT ? OFFSET ?";
        connection.query(sql, [limit, offset], function(err, results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    var list = [];
                    async.eachSeries(results, function(element, callback) {
                        list.push({
                            "id" : element.id,
                            "type" : element.board_id,
                            "title" : element.title,
                            "date" : element.GMT9
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
                "code" : "err028",
                "message" : "이용약관 목록 불러오기를 실패하였습니다."
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

router.get('/:accesstermId', function(req, res, next) {
    var accesstermId = parseInt(req.params.accesstermId);

    //getConnection
    function getConnection(callback){
        pool.getConnection(function(err, connection){
            if(err){
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    //selectAccessterm
    function selectAccessterm(connection, callback) {
        var select = "select body "+
            "from article "+
            "where board_id = 2 and id = ?";
        connection.query(select, [accesstermId], function(err, results) {
            connection.release();
            if(err) {
                callback(err);
            } else {
                if(results.length === 0) {
                    res.json({"message" : "해당하는 이용약관이 없습니다."});
                } else {
                    var info = {
                        "results" : {
                            "list" : [
                                {
                                    "body" : results[0].body
                                }
                            ]
                        }
                    };

                    callback(null, info);
                }
            }
        });
    }

    async.waterfall([getConnection, selectAccessterm], function(err, result) {
        if(err) {
            err.message = "이용약관 상세 불러오기를 실패하였습니다.";
            err.code = "err029";
            next(err);
        } else {
            res.json(result);
        }
    });
});

module.exports = router;