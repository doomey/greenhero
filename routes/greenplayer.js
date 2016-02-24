var express = require('express');
var url = require('url');
var router = express.Router();
var queryString = require('querystring');
var async = require('async');


router.get('/', function(req, res, next){
    //
    //var urlObj = url.parse(req.url).query;
    //var urlQuery = queryString.parse(urlObj);
    //var page = urlQuery.page;
    //var limit = 10;
    //var offset = (page - 1) * 10;
    //
    //function getConnection(callback){
    //    pool.getConnection(function(err, connection){
    //        if(err){
    //            callback(err);
    //        } else {
    //            callback(null, connection);
    //        }
    //    });
    //}
    //
    //function selectArticles(connection, callback){
    //    var sql = "";
    //    var notices_num = 1;
    //
    //    connection.query(sql, [limit, offset], function(err,results){
    //        connection.release();
    //        if(err){
    //            callback(err);
    //        } else {
    //            if(results.length){
    //                callback(null, results);
    //            } else {
    //                callback(err);
    //            }
    //        }
    //    });
    //}
    //
    //async.waterfall([getConnection, selectArticles], function(err, result){
    //    if(err){
    //        //var error = new Error({
    //        //    "error": {
    //        //        "code": "err022",
    //        //        "message": "공지사항 불러오기를 실패하였습니다..."
    //        //    }
    //        //});
    //
    //        next(err);
    //    } else {
    //        var list = [];
    //        for(var i=0;i<result.length;i++){
    //            list.push({
    //                "epId" : result[i].id,
    //                "title" : result[i].title,
    //                "thumbnail" : "/test/test2",
    //                "epName" : result[i].cname,
    //                "sDate" : result[i].sdate,
    //                "eDate" : result[i].edate,
    //                "content" : result[i].content,
    //                "file" : "/file/file2"
    //            });
    //        }
    //
    //        res.json({
    //            "result" : {
    //                "page" : page,
    //                "listPerPage" : limit,
    //                "list" : list
    //            }
    //        });
    //    }
    //});
    res.json({
        "result" : {
            "page" : 1,
            "listPerPage" : 10,
            "list" : [{
                "epId": 1,
                "title": "숲을 우리가 지켜요",
                "thumbnail": "/photos/xxxxxx.jpg",
                "epName": "하나둘셋주식회사",
                "sDate": "2016-01-01 12:00:00",
                "eDate": "2016-02-01 12:00:00",
                "content" : "좋은 동영상 잘 감상하세요...",
                "file" : "/multimedia/xxxxxx.mp4"
            }]
        }
    });
});

module.exports = router;