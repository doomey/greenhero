var express = require('express');
var async = require('async');
var router = express.Router();
var url = require('url');
var logger = require('./logger');

router.get('/', function(req, res, next){
    var page = parseInt(req.query.page);
    page = isNaN(page) ? 1 : page;
    page = (page<1) ? 1 : page;
    var limit = 10;
    var offset = (page - 1) * limit;

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
                    callback(null, [{"message" : "이용약관이 없습니다."}]);
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
            logger.log('error', 'accessterms 목록보기 에러 : ' + err);
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
                if(results.length){
                    callback(null, [{"body" : results[0].body}])
                } else {
                    callback(null, [{"message" : "이용약관이 없습니다."}]);
                }
            }
        });
    }

    async.waterfall([getConnection, selectAccessterm], function(err, result) {
        if(err){
            var err = {
                "code" : "err029",
                "message" : "이용약관 상세 불러오기를 실패하였습니다."
            };
            logger.log('error', 'notices 상세보기 에러 : ' + err);
            next(err);
        } else {
            res.json({
                "result" : {
                    "list" : result
                }
            });
        }
    });
});

module.exports = router;