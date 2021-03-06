var express = require('express');
var router = express.Router();
var url = require('url');
var queryString = require('querystring');
var async = require('async');
var logger = require('./logger');

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

    function selectItems(connection, callback){
        var sql = "SELECT i.id, i.name, p.photourl, i.star, i.price " +
                  "FROM greenitems i " +
                  "JOIN photos p ON (p.refer_type=3 AND p.refer_id = i.id) " +
                  "limit ? offset ?";
        connection.query(sql, [limit, offset], function(err, results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    var list = [];
                    async.eachSeries(results, function(result, callback) {
                        list.push({
                            "id" : result.id,
                            "name": result.name,
                            "picture": result.photourl,
                            "star" : result.star,
                            "price": result.price
                        });
                        callback(null);
                    }, function(err) {
                        if(err) {
                            callback(err);
                        } else {
                            callback(null, list);
                        }
                    });
                } else {
                    callback(null, [{"message" : "결과가 없습니다."}]);
                }
            }
        });
    }

    async.waterfall([getConnection, selectItems], function(err, result){
        if(err){
            var err = {
                "code" : "err021",
                "message" : "GREEN SHOP의 물건 목록들을 불러올 수 없습니다."
            };
            logger.log('error', err);
            next(err);
        } else {
            res.json({
                "result" : {
                    "page" : page,
                    "itemsPerPage" : limit,
                    "items" : result
                }
            });
        }
    });
});

router.get('/:itemsId', function(req, res, next){
    var itemsId = req.params.itemsId;
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

    function selectItems(connection, callback){
        var sql = "SELECT i.tquantity, i.description " +
                  "FROM greenitems i " +
                  "JOIN photos p ON (p.refer_type=3 AND p.refer_id = i.id) " +
                  "WHERE i.id = ? " +
                  "limit ? offset ?";
        connection.query(sql, [itemsId, limit, offset], function(err,results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    callback(null, {
                        "itemCount": results[0].tquantity,
                        "itemDescription": results[0].description
                    });
                } else {
                    callback(null, {"message" : "결과가 없습니다."});
                }
            }
        });
    }
    //
    async.waterfall([getConnection, selectItems], function(err, result){
        if(err){
            var err = {
                "code" : "err022",
                "message" : "GREEN SHOP의 물건 상세들을 불러올 수 없습니다."
            };
            logger.log('error', err);
            next(err);
        } else {
            res.json({
                "result" : {
                    "items" : [result]
                }
            });
        }
    });
});

module.exports = router;
