var express = require('express');
var router = express.Router();
var async = require('async');
router.get('/', function(req, res, next) {
    if(req.secure) {
        var page = parseInt(req.query.page);
        page = isNaN(page)? 1 : page;
        page = (page<1)? 1 : page;

        var limit = 2;
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

        function selectOrders(connection, callback) {
            var select = "select o.id as id, g.name as name, g.picture as picture, g.price as price, od.quantity as quantity, (g.price * od.quantity) as iprice "+
                         "from greendb.orders o join greendb.orderdetails od on (o.id = od.order_id) "+
                         "join greendb.greenitems g on (od.greenitems_id = g.id) "+
                         "where iparty_id = ? limit ? offset ?";
            connection.query(select, [1, limit, offset], function(err, results) {
                connection.release();
                if(err) {
                    callback(err);
                } else {
                    var message = {
                        "result" : {
                            "page" : page,
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
        async.waterfall([getConnection, selectOrders], function(err, message) {
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