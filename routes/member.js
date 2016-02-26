var express = require('express');
var router = express.Router();
var async = require('async');
var passport = require('passport');
var gcm = require('node-gcm');

router.post('/', function(req, res, next) {
        if(req.secure) {
            passport.authenticate('google-token', function(err, user, info) {
                if(err) {
                    err.code = "err001";
                    err.message = "연동에 실패하였습니다...";
                    next(err);
                } else {
                    req.logIn(user, function(err) {
                        if(err) {
                            next(err);
                        } else {
                            res.json({
                                "result" : {
                                    "message" : "로그인이 완료 되었습니다. 감사합니다!"
                                }
                            });
                        }
                    });
                }
            });
        } else {
            var err = new Error("SSL/TLS Upgrade Required");
            err.status = 426;
            next(err);
        }
    });

router.get('/me', function(req, res, next) {
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
            var select = "select i.google_name as name, i.nickname as nickname, i.totalleaf as totalleaf, d.id as id, d.receiver as receiver, d.phone as phone, d.add_phone as addphone, d.ad_code as adcode, d.address as address "+
                          "from greendb.iparty i join (select * "+
                          "                            from greendb.daddress "+
                          "                            where iparty_id = 1 and id = (select max(id) "+
                          "                                                          from greendb.daddress "+
                          "                                                          where iparty_id = 1)) d "+
                          "                       on (i.id = d.iparty_id)";
            connection.query(select, [1], function(err, results) {
                if(err) {
                    connection.release();
                    callback(err);
                } else {
                    var message = {
                        "result" : {
                            "gName" : results[0].name,
                            "nickname" : results[0].nickname,
                            "totalLeaf" : results[0].totalleaf,
                            "todayleaf" : 0,
                            "address" : {
                                "dName" : results[0].receiver,
                                "dPhone1" :results[0].phone,
                                "dPhone2" : results[0].addphone,
                                "dAdcode" : results[0].adcode,
                                "dAddress" : results[0].address
                            }
                        }
                    };
                    console.log('메세지', message);
                    callback(null, message, connection);
                }
            });
        }

        function selectLeafhistory(message, connection, callback) {
            var select = "select sum(changedamount) as chdamt "+
                         "from greendb.leafhistory "+
                         "where leaftype = 1 and iparty_id = ? and applydate = date(now())";
            connection.query(select, [1], function(err, results) {
                connection.release();
                if(err) {
                    callback(err);
                } else {
                    message.result.todayleaf = (todayleaf - (isNaN(results[0].chdamt)?0:results[0].chdamt));
                    callback(null, message);
                }
            });
        }

        async.waterfall([getConnection, selectIparty, selectLeafhistory], function(err, message) {
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

router.put('/me', function(req, res, next) {
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
            var update = "update greendb.iparty "+
                "set nickname = ? "+
                "where id = ?";
            connection.query(update, [nickname, 1], function(err, result) {
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

router.get('/me/leafs', function(req, res, next) {
    if(req.secure) {
        console.log('들어옴');
        var page = parseInt(req.query.page);
        page = isNaN(page)? 1:page;
        page = (page < 1)? 1:page;
        var limit = 2;
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
            var select = "select id, applydate, leaftype, changedamount "+
                          "from greendb.leafhistory "+
                          "where iparty_id = ? limit ? offset ?";
            connection.query(select, [1, limit, offset], function(err, results) {
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
                                "leafType": element.leafType,
                                "leafApplydate": element.applydate,
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

router.get('/me/bells', function(req, res, next) {
    var nickname = req.body.nickname;
    var msg = req.body.message;
    var date = req.body.date;
    var articleId = req.body.articleId;
    var replyId = req.body.replyId;
    var userId = req.body.id;

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
        var select = "select registration_token "+
                     "from greendb.iparty "+
                     "where id = ?";
        connection.querty(select, [1], function(err, results) {
            connection.release();
            if(err) {
                callback(err);
            } else {
                callback(null, results[0].registration_token);
            }
        });
    }

    async.waterfall([getConnection, selectIparty], function(err, registraion_token) {
        if(err) {
            err.code = "err005";
            err.message = "알림종을 불러올 수 없습니다."
            next(err);
        } else {
            var server_access_key = 'AIzaSyBaFeq5YGUXdRQmmTLJV2MqmqciZV5AVQk';
            var sender = new gcm.Sender(server_access_key);
            var registrationIds = [];

            var registration_id = registraion_token;
            registrationIds.push(registration_id);

            var message = new gcm.Message({
                collapseKey: 'demo',
                delayWhileIdle: true,
                timeToLive: 3,
                data : {
                    who: nickname,
                    message: msg,
                    when: date
                }
            });

            sender.send(message, registrationIds, 4, function(err, result) {
                console.log(result);
            })

            sender.send(message, tokens, function(err, result) {
                if(err) {
                    next(err);
                } else {
                    result.results.forEach(function(item) {
                        if(item.message_id) {
                            console.log('success : '+item.message_id);
                        } else {
                            console.log('error : '+item.error);
                        }
                    });
                }
            });
        }
    });
});

router.get('/me/baskets', function(req, res, next) {
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
                     "FROM greendb.cart c join greendb.greenitems i "+
                     "                    on (c.greenitems_id = i.id) "+
                     "where iparty_id = ?";
        connection.query(select, [1], function(err, results) {
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

router.post('/me/baskets', function(req, res, next) {
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

    console.log(iid);
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
            var insert = "insert into greendb.cart(greenitems_id, iparty_id, quantity) "+
                "values(?, ?, ?)";
            connection.query(insert, [element, 1, qt[index]], function(err, result) {
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
                var update = "update greendb.cart " +
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
            var deletequery = "delete from greendb.cart " +
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