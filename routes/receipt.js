var express = require('express');
var router = express.Router();
var async = require('async');
var logger = require('./logger');

function isLoggedIn(req, res, next) {
    if(!req.isAuthenticated()) {
        var err = new Error('로그인이 필요합니다...');
        err. status = 401;
        next(err);
    } else {
        next(null, {"message" : "로그인이 완료되었습니다..."});
    }
}

router.get('/', isLoggedIn, function(req, res, next) {
    if(req.secure) {
        var page = parseInt(req.query.page);
        page = isNaN(page)? 1 : page;
        page = (page<1)? 1 : page;

        var limit = 10;
        var offset = limit*(page-1);
        //1. connection
        //orders, orderdetails join

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if(err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            });
        }

        function getTotal(connection, callback) {
            var select = "SELECT count(id) as cnt "+
                         "FROM orders o join orderdetails od on(o.id = od.order_id) "+
                         "where iparty_id = ?";
            connection.query(select, [req.user.id], function(err, results) {
                if(err) {
                    connection.release();
                    callback(err);
                } else {
                    callback(null, results[0].cnt, connection);
                }
            });
        }
        function selectOrders(cnt, connection, callback) {
            var select = "select o.id as id, o.date as date, g.name as name, p.photourl as picture, g.price as price, od.quantity as quantity, (g.price * od.quantity) as iprice, g.id as gid "+
                         "from orders o join orderdetails od on (o.id = od.order_id) "+
                         "join greenitems g on (od.greenitems_id = g.id) "+
                         "join photos p on (p.refer_type = 3 and p.refer_id = g.id)" +
                         "where iparty_id = ? " +
                         "order by o.id asc limit ? offset ?";
            connection.query(select, [req.user.id, limit, offset], function(err, results) {
                connection.release();
                if(err) {
                    callback(err);
                } else {
                    var message = {
                        "result" : {
                            "page" : page,
                            "cnt" : cnt,
                            "itemsPerPage" : limit,
                            "items" : []
                        }
                    };
                    async.each(results, function(result, cb) {
                        message.result.items.push({
                                    "id" : result.gid,
                                    "orderId" : result.id,
                                    "date" : result.date,
                                    "name" : result.name,
                                    "picture" : result.picture,
                                    "price" : result.price,
                                    "quantity" : result.quantity,
                                    "iPrice" : result.iprice
                                });
                        cb(null);
                    }, function(err) {
                        if(err) {
                            callback(err);
                        }
                    });
                    callback(null, message);
                }
            });
        }
        async.waterfall([getConnection, getTotal, selectOrders], function(err, message) {
            if(err) {
                err.code = "err022";
                err.message = "구매내역을 불러올 수 없습니다.";
                logger.log('error', err);
                next(err);
            } else {
                res.json(message);
            }
        });
    } else {
        var err = new Error("SSL/TLS Upgrade Required");
        err.status = 426;
        next(err);
    }
})
module.exports = router;