var express = require('express');
var router = express.Router();
var async = require('async');
var passport = require('passport');
var gcm = require('node-gcm');
var sqlAes = require('./sqlAES.js');
var logger = require('./logger');

sqlAes.setServerKey(serverKey);

function isLoggedIn(req, res, next) {
    if(!req.isAuthenticated()) {
        var err = new Error('로그인이 필요합니다...');
        err. status = 401;
        next(err);
    } else {
        next(null, {"message" : "로그인이 완료되었습니다..."});
    }
}

router.post('/login', function(req, res, next) {
    if(req.secure) {
        passport.authenticate('google-id-token', function(err, user, info) {
            if(err) {
                next(err);
            } else if(!user){
                var err = new Error('유효한 토큰이 아닙니다...');
                err.status = 401;
                next(err);
            } else {
                req.logIn(user, function(err) {
                    if(err) {
                        next(err);
                    } else {
                        res.json({"message" : user.nickname+"님 환영합니다!"});
                    }
                });
            }
        })(req, res, next);
    } else {
        var err = new Error('SSL/TLS Upgrade Required...');
        err.status = 426;
        next(err);
    }
});

router.get('/me', isLoggedIn, function(req, res, next) {
    if(req.secure) {
        //오늘 획득 가능한 나뭇잎 양
        var todayleaf = 45;

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if(err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            })
        }

        function selectIparty(connection, callback) {
            var select = "select google_name, nickname, totalleaf " +
                  "from iparty " +
               "where id = ?";
            connection.query(select, [req.user.id], function(err, results) {
                logger.log('info', "유저 검색결과 : " +  results);
                if(err) {
                    connection.release();
                    callback(err);
                } else {
                    var message = {
                        "result" : {
                            "gName" : results[0].google_name,
                            "nickname" : (!results[0].nickname)? results[0].name : results[0].nickname,
                            "totalLeaf" : results[0].totalleaf,
                            "todayLeaf" : 0,
                            "address" : {
                            }
                        }
                    };
                    callback(null, message, connection);
                }
            });
        }

        function selectDaddress(message, connection, callback) {
            var select ="SELECT "+ sqlAes.decrypt("receiver") + sqlAes.decrypt("phone") + "add_phone, " + "ad_code, " + sqlAes.decrypt("address", true) +
                         "FROM daddress "+
                         "where iparty_id = ? " +
                         "order by id desc limit 1 ";
            connection.query(select, [req.user.id], function(err, results) {
                if(err) {
                    connection.release();
                    callback(err);
                } else {
                    message.result.address = {
                        "gName" : results[0].receiver,
                        "dPhone1" : results[0].phone,
                        "dPhone2" : results[0].add_phone,
                        "dAdcode" : results[0].ad_code,
                        "dAddress" : results[0].address
                    };
                    callback(null, message, connection);
                }
            });
        }

        function selectLeafhistory(message, connection, callback) {
            var select = "select sum(changedamount) as chdamt "+
                         "from leafhistory "+
                         "where leaftype = 1 and iparty_id = ? and applydate = date(now())";
            connection.query(select, [req.user.id], function(err, results) {
                connection.release();
                if(err) {
                    callback(err);
                } else {
                    message.result.todayLeaf = (todayleaf - (isNaN(results[0].chdamt)?0:results[0].chdamt));
                    callback(null, message);
                }
            });
        }

        async.waterfall([getConnection, selectIparty, selectDaddress, selectLeafhistory], function(err, message) {
            if(err) {
                err.code = "err002";
                err.message = "내 정보를 불러올 수 없습니다...";
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
});

router.put('/me', isLoggedIn, function(req, res, next) {
    if(req.secure) {
        var nickname = req.body.nickname;

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if(err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            });
        }

        function updateIparty(connection, callback) {
            var update = "update iparty "+
                "set nickname = ? "+
                "where id = ?";
            connection.query(update, [nickname, req.user.id], function(err, result) {
                connection.release();
                if(err) {
                    callback(err);
                } else {
                    var message = {
                        "result" : {
                            "message" : "내 정보가 수정되었습니다."
                        }
                    };
                    callback(null, message);
                }
            });
        }
        async.waterfall([getConnection, updateIparty], function(err, message) {
            if(err) {
                err.code = "err003";
                err.message = "내 정보를 수정하는데 실패하였습니다...";
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
});

router.get('/me/leafs', isLoggedIn, function(req, res, next) {
    if(req.secure) {
        var page = parseInt(req.query.page);
        page = isNaN(page)? 1:page;
        page = (page < 1)? 1:page;
        var limit = 10;
        var offset = limit*(page-1);

        //1. getConnection, 2. leafhistory테이블 select
        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if(err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            })
        }

        function selectLeafhistory(connection, callback) {
            var select = "select id, date_format(CONVERT_TZ(applydate, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s') as 'GMT9', leaftype, changedamount "+
                          "from leafhistory "+
                          "where iparty_id = ? limit ? offset ?";
            connection.query(select, [req.user.id, limit, offset], function(err, results) {
                connection.release();
                if(err) {
                    callback(err);
                } else {
                        var message = {
                            "result": {
                                "page": page,
                                "listPerPage": limit,
                                "list": []
                            }
                        };
                        async.each(results, function(element, callback) {
                            message.result.list.push({
                                "leafType": element.leaftype,
                                "leafApplydate": element.GMT9,
                                "leafChangedamount": element.changedamount
                            });
                            callback(null);
                        }, function(err, result) {
                            if(err) {
                                callback(err);
                            }
                        });
                        callback(null, message);
                }
            });
        }

        async.waterfall([getConnection, selectLeafhistory], function(err, message) {
            if(err) {
                err.code = "err004";
                err.message = "나뭇잎 사용내역을 조회할 수 없습니다...";
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
});

router.get('/me/baskets', isLoggedIn, function(req, res, next) {
    function getConnection(callback) {
        pool.getConnection(function(err, connection) {
            if(err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function selectCartAndGreenitems(connection, callback) {
        var select = "SELECT c.id as cartId, greenitems_id, i.picture as picture, i.name as name, i.price as price, c.quantity as quantity, (c.quantity * i.price) as iprice "+
                     "FROM cart c join greenitems i "+
                     "                    on (c.greenitems_id = i.id) "+
                     "where iparty_id = ?";
        connection.query(select, [req.user.id], function(err, results) {
            if(err) {
                err.code = "err018";
                err.message = "장바구니를 사용할 수 없습니다...";
                callback(err);
            } else {

                var message = {
                    "result" : {
                        "items" : [],
                        "totalPrice" : 0
                    }
                };

                var totalprice = 0;
                async.each(results, function(element, callback) {
                    message.result.items.push({
                        "cartId" : element.cartId,
                        "itemId": element.greenitems_id,
                        "picture": element.picture,
                        "name": element.name,
                        "price": element.price,
                        "quantity": element.quantity,
                        "iPrice": element.iprice
                    });
                    totalprice += element.iprice
                    callback(null);
                }, function(err, result) {
                    if(err) {
                        callback(err);
                    } else {
                        message.result.totalPrice = totalprice;
                        callback(null, message);
                    }
                });
            }
        })
    }
    async.waterfall([getConnection, selectCartAndGreenitems], function(err, result) {
        if(err) {
            next(err);
        } else {
            res.json(result);
        }
    });
    });

router.post('/me/baskets', isLoggedIn, function(req, res, next) {
    var itemId = req.body.itemId;
    var iid = [];
    var quantity = req.body.quantity;
    var qt = [];

    if((typeof itemId)=== 'string') {
        iid.push(parseInt(itemId));
        qt.push(parseInt(quantity));
    } else {
        itemId.forEach(function(item) {
            iid.push(parseInt(item));
        });
        quantity.forEach(function(item) {
            qt.push(parseInt(item));
        });
    }
    //커넥션
    function getConnection(callback) {
        pool.getConnection(function(err, connection) {
            if(err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function insertCart(connection, callback) {
        var index = 0;
        async.each(iid, function(element, callback) {
            var insert = "insert into cart(greenitems_id, iparty_id, quantity) "+
                "values(?, ?, ?)";
            connection.query(insert, [element, req.user.id, qt[index]], function(err, result) {
                if(err) {
                    connection.release();
                    callback(err);
                } else {
                    callback(null);
                }
            });
            index++;
        }, function(err, result) {
            if(err) {
                callback(err);
            } else {
                connection.release();
                index = 0;
                callback(null, result);
            }
        });
    }

    async.waterfall([getConnection, insertCart], function(err, result) {
        if(err) {
            err.code = "err019";
            err.message = "장바구니에 물건 추가를 실패하였습니다...";
            next(err);
        } else {
            res.json({
                "result" : {
                    "message" : "장바구니에 물품을 추가하였습니다."
                }
            });
        }
    });

});

router.put('/me/baskets', function(req, res, next) {
    var cartId = (req.body.cartId);
    var cid = [];
    var quantity = (req.body.quantity);
    var qt = [];

    if((typeof cartId)=== 'string') {
        cid.push(parseInt(cartId));
        quantity.push(parseInt(quantity));
    } else {
        cartId.forEach(function(item) {
            cid.push(parseInt(item));
        });
        quantity.forEach(function(item) {
            qt.push(parseInt(item));
        });
    }


    function getConnection(callback) {
        pool.getConnection(function(err, connection) {
            if(err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function updateOrDeleteCart(connection, callback) {
        var index = 0;
        if (qt[index] !== 0) {
            async.each(cid, function(element, callback) {
                //update
                var update = "update cart " +
                    "set quantity = ? " +
                    "where id = ?";
                connection.query(update, [qt[index], element], function (err, result) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        callback(null);
                    }
                });
                index++;
            }, function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    connection.release();
                    callback(null, result);
                }
            });
            index = 0;
        } else {
            //delete
            var deletequery = "delete from cart " +
                "where id in (?)";
            connection.query(deletequery, [cid], function (err, result) {
                connection.release();
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }
    }

    async.waterfall([getConnection, updateOrDeleteCart], function (err, result) {
        if (err) {
            err.code = "err020";
            err.message = "장바구니에 있는 물품 수정에 실패하였습니다...";
            next(err);
        } else {
            res.json({
                "result": {
                    "message": "장바구니에 물품을 수정하였습니다."
                }
            });
        }
    });

});



module.exports = router;