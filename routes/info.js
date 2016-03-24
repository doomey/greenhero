var express = require('express');
var router = express.Router();
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
    var page = parseInt(req.query.page);
    //type 값
    //1:공지사항, 2:이용약관, 3:FAQ, 4:운영정책
    var type = parseInt(req.query.type);
    page = isNaN(page) ? 1 : page;
    page = (page<1) ? 1 : page;
    var limit = 10;
    var offset = (page - 1) * limit;

    function selectArticles(connection, callback){
        var sql = "SELECT id, title, date_format(CONVERT_TZ(wdatetime, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as 'GMT9', board_id " +
            "FROM article " +
            "WHERE board_id = ? " +
            "order by id desc " +
            "LIMIT ? OFFSET ?";
        connection.query(sql, [type, limit, offset], function(err, results){
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
                } else {
                    callback(null, [{"message" : "운영정보가 없습니다."}]);
                }
            }
        });
    }

    async.waterfall([getConnection, selectArticles], function(err, result){
        if(err){
            var err = {
                "code" : "err027",
                "message" : "운영정보 목록 불러오기를 실패하였습니다."
            };
            logger.log('error', '운영정보 목록보기 에러 : ' + err);
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

router.get('/:infoId', function(req, res, next){
    var infoId = parseInt(req.params.infoId);

    function selectArticle(connection, callback) {
        var sql = "select body "+
            "from article "+
            "where id = ?";
        connection.query(sql, [infoId], function(err, results) {
            connection.release();
            if(err) {
                callback(err);
            } else {
                if(results.length){
                    callback(null, [{"body" : results[0].body}])
                } else {
                    callback(null, [{"message" : "번호에 해당하는 글이 없습니다."}]);
                }
            }
        });
    }

    async.waterfall([getConnection, selectArticle], function(err, result) {
        if(err){
            var err = {
                "code" : "err028",
                "message" : "운영정보 상세 불러오기를 실패하였습니다."
            };
            logger.log('error', '운영정보 상세보기 에러 : ' + err);
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