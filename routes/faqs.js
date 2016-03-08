var express = require('express');
var async = require('async');
var router = express.Router();
var url = require('url');
var queryString = require('querystring');

router.get('/', function(req, res, next){
    var urlObj = url.parse(req.url).query;
    var urlQuery = queryString.parse(urlObj);
    //var page = isNaN(urlQuery.page) || (urlQuery.page < 1) ? 1 : urlQuery.page;
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
        var sql = "SELECT id, title, body, date_format(CONVERT_TZ(wdatetime, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as 'GMT9', board_id " +
            "FROM greendb.article " +
            "WHERE board_id = ? " +
            "order by id desc " +
            "LIMIT ? OFFSET ?";
        var faqs_num = 2;
        connection.query(sql, [faqs_num, limit, offset], function(err,results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    var list = [];
                    async.each(results, function(element, callback){
                        list.push({
                            "id" : element.id,
                            "type" : element.board_id,
                            "title" : element.title,
                            "date" : element.GMT9,
                            "body" : element.body
                        });
                        callback(null);
                    }, function(err, result){
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
                "code" : "err022",
                "message" : "FAQ 불러오기를 실패하였습니다."
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

module.exports = router;