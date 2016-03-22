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
            "WHERE board_id = 3 " +//faq : 3
            "order by id desc " +
            "LIMIT ? OFFSET ?";
        connection.query(sql, [limit, offset], function(err, results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    var list = [];
                    async.eachSeries(results, function(result, callback){
                        list.push({
                            "id" : result.id,
                            "type" : result.board_id,
                            "title" : result.title,
                            "date" : result.GMT9
                        });
                        callback(null);
                    }, function(err){
                        if(err) {
                            callback(err);
                        } else {
                            callback(null, list);
                        }
                    });
                } else { //셀렉트는 정상적으로 처리되었지만 결과가 없는 경우
                    callback(null, [{"message" : "FAQ가 없습니다."}]);
                }
            }
        });
    }

    async.waterfall([getConnection, selectArticles], function(err, result){
        if(err){
            var err = {
                "code" : "err030",
                "message" : "FAQ 목록 불러오기를 실패하였습니다."
            }
            logger.log('error', 'FAQ 목록보기 에러 : ' + err);
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

router.get('/:faqId', function(req, res, next) {
    var faqId = parseInt(req.params.faqId);

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

    //selectFAQ
    function selectFaq(connection, callback) {
        var select = "select body "+
            "from article "+
            "where board_id = 3 and id = ?";
        connection.query(select, [faqId], function(err, results) {
            connection.release();
            if(err) {
                callback(err);
            } else {
                if(results.length){
                    callback(null, [{"body" : results[0].body}])
                } else {
                    callback(null, [{"message" : "FAQ가 없습니다."}]);
                }
            }
        });
    }

    async.waterfall([getConnection, selectFaq], function(err, result) {
        if(err){
            var err = {
                "code" : "err031",
                "message" : "FAQ 상세 불러오기를 실패하였습니다."
            };
            logger.log('error', 'faqs 상세보기 에러 : ' + err);
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