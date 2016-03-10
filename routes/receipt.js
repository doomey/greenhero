var express = require('express');
var router = express.Router();
var async = require('async');

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
        console.log('들어옴');
        var page = parseInt(req.query.page);
        page = isNaN(page)? 1 : page;
        page = (page<1)? 1 : page;

        var limit = 4;
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
            var select = "select count(*) as cnt "+
                          "from orders";
            connection.query(select, [], function(err, results) {
                if(err) {
                    connection.release();
                    callback(err);
                } else {
                    callback(null, results[0].cnt, connection);
                }
            });
        }
        function selectOrders(cnt, connection, callback) {
            var select = "select o.id as id, g.name as name, g.picture as picture, g.price as price, od.quantity as quantity, (g.price * od.quantity) as iprice "+
                         "from orders o join orderdetails od on (o.id = od.order_id) "+
                         "join greenitems g on (od.greenitems_id = g.id) "+
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
                    console.log(message);
                    results.forEach(function(item) {
                        message.result.items.push({
                            "id" : item.id,
                            "name" : item.name,
                            "picture" : item.picture,
                            "price" : item.price,
                            "quantity" : item.quantity,
                            "iPrice" : item.iprice
                        });
                    });
                    console.log(message);
                    callback(null, message);
                }
            });
        }
        async.waterfall([getConnection, getTotal, selectOrders], function(err, message) {
            if(err) {
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