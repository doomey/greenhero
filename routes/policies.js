var express = require('express');
var async = require('async');
var router = express.Router();
var url = require('url');
var queryString = require('querystring');

router.get('/', function(req, res, next){
    var urlObj = url.parse(req.url).query;
    var urlQuery = queryString.parse(urlObj);
    var page = urlQuery.page;
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
        var sql = "SELECT id, title, body, wdatetime, board_id " +
            "FROM greendb.article " +
            "WHERE board_id = ?";
        var policies_num = 4;
        connection.query(sql, [policies_num], function(err,results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    callback(null, results);
                } else {
                    var err = new Error('공지사항 불러오기를 실패하였습니다.');
                    err.status = 500;
                    callback(err);
                }
            }
        });
    }

    async.waterfall([getConnection, selectArticles], function(err, result){
        if(err){
            var err = {
                "code" : "err024",
                "message" : "운영정책 불러오기를 실패하였습니다."
            }
            next(err);
        } else {
            var list = [];
            for(var i=0;i<result.length;i++){
                list.push({
                    "id" : result[i].id,
                    "type" : result[i].board_id,
                    "title" : result[i].title,
                    "date" : result[i].wdatetime,
                    "body" : result[i].body
                });
            }

            res.json({
                "result" : {
                    "page" : page,
                    "listPerPage" : limit,
                    "list" : list
                }
            });
        }
    });
});

module.exports = router;