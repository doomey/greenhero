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
            "WHERE board_id = 4 " +//공지사항 : 1
            "order by id desc " +
            "LIMIT ? OFFSET ?";
        connection.query(sql, [limit, offset], function(err, results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    var list = [];
                    async.eachSeries(results, function(element, callback){
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
                    callback(null, [{"message" : "운영정책이 없습니다."}]);
                }
            }
        });
    }

    async.waterfall([getConnection, selectArticles], function(err, result){
        if(err){
            var err = {
                "code" : "err032",
                "message" : "운영정책 목록 불러오기를 실패하였습니다."
            };
            logger.log('error', 'policies 목록보기 에러 : ' + err);
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

router.get('/:policyId', function(req, res, next) {
    var policyId = parseInt(req.params.policyId);

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

    //selectNotice
    function selectNotice(connection, callback) {
        var select = "select body "+
                     "from article "+
                     "where board_id = 4 and id = ?";
        connection.query(select, [policyId], function(err, results) {
            connection.release();
            if(err) {
                callback(err);
            } else {
                if(results.length){
                    callback(null, [{"body" : results[0].body}])
                } else {
                    callback(null, [{"message" : "운영정책이 없습니다."}]);
                }
            }
        });
    }

    async.waterfall([getConnection, selectNotice], function(err, result) {
        if(err){
            var err = {
                "code" : "err033",
                "message" : "운영정책 상세 불러오기를 실패하였습니다."
            };
            logger.log('error', 'policies 상세보기 에러 : ' + err);
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