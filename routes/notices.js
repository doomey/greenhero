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
        var notices_num = 1;
        connection.query(sql, [notices_num, limit, offset], function(err,results){
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
        //err = new Error();
        if(err){
            var err = {
                "code" : "err021",
                "message" : "공지사항 불러오기를 실패하였습니다."
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

router.get('/:noticeid', function(req, res, next) {
   var noticeid = parseInt(req.params.noticeid);

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
      var select = "select id, title, body, date_format(CONVERT_TZ(wdatetime,'+00:00','+9:00'),'%Y-%m-%d %H:%i:%s') as wdatetime "+
                    "from greendb.article "+
                    "where board_id = 1 and id = ?";
      connection.query(select, [noticeid], function(err, results) {
         connection.release();
         if(err) {
            callback(err);
         } else {
            var info = {
               "results" : {
                  "id" : noticeid,
                  "type" : 1,
                  "title" : results[0].title,
                  "date" : results[0].wdatetime,
                  "body" : results[0].body
               }
            };

            callback(null, info);
         }
      });
   }

   async.waterfall([getConnection, selectNotice], function(err, result) {
      if(err) {
         err.message = "공지사항 불러오기 실패하였습니다...";
         err.code = "err022";
         next(err);
      } else {
         res.json(result);
      }
   });
});

module.exports = router;