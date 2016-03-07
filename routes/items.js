var express = require('express');
var router = express.Router();
var url = require('url');
var queryString = require('querystring');
var async = require('async');

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

    function selectItems(connection, callback){
        var sql = "SELECT id, name, picture, star, price, tquantity, description " +
                  "from greenitems " +
                  "limit ? offset ?";
        connection.query(sql, [limit, offset], function(err,results){
            connection.release();
            if(err){
                callback(err);
            } else {
                if(results.length){
                    var list = [];
                    async.each(results, function(element, callback) {
                        list.push({
                            "id" : element.id,
                            "name": element.name,
                            "picture": element.picture,
                            "star" : element.star,
                            "price": element.price,
                            "itemCount": element.tquantity,
                            "itemDescription": element.description
                        });
                        callback(null);
                    }, function(err, result) {
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

    async.waterfall([getConnection, selectItems], function(err, result){
        if(err){
            var err = {
                "code" : "err014",
                "message" : "GREEN SHOP의 물건들을 불러올 수 없습니다."
            }
            next(err);
        } else {
            res.json({
                "result" : {
                    "page" : page,
                    "listPerPage" : limit,
                    //"cartUrl" : "https://ec2-52-79-101-177.ap-northeast-2.compute.amazonaws.com/members/me/baskets",
                    //"orderUrl" : "https://ec2-52-79-101-177.ap-northeast-2.compute.amazonaws.com/orders",
                    "items" : result
                }
            });
        }
    });
});

module.exports = router;