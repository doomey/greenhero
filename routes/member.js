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
        logger.log('debug', req.body);
        //logger.log('info', req.body);
        passport.authenticate('google-id-token', function(err, user, info) {
            logger.log('debug', user);
            //logger.log('info', user);
            if(err) {
                logger.log('warn', user);
                next(err);
            } else if(!user){
                var err = new Error('유효한 토큰이 아닙니다...');
                err.code = "err001";
                err.status = 401;
                logger.log('warn', err);
                next(err);
            } else {
                req.logIn(user, function(err) {
                    if(err) {
                        logger.log('warn', err);
                        next(err);
                    } else {
                        logger.log('info', '로그인 성공');
                        if(req.user.nickname !== undefined) {
                            logger.log('info', req.user.nickname + '님 로그인');
                            res.json({"message" : user.nickname + "님 환영합니다!"});
                        } else {
                            logger.log('info', 'ID '+ req.user.id +'님 구글로그인 연동');
                            res.json({"message" : "구글 연동되었습니다. 환영합니다! 'I AM GREENHERO'에서 닉네임을 바꿔주세요. 처음 닉네임은 이름입니다."});
                        }
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
        var resentleaf = 0;
        var totalleaf = 0;

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if(err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            })
        }

        function selectLeaf(connection, callback) {
            var sql = "select sum(changedamount) as toleaf " +
                      "from leafhistory " +
                      "where iparty_id = 5  and leaftype != 0 and to_days(applydate) = to_days(now())";
            connection.query(sql, [req.user.id], function(err, results) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    resentleaf = parseInt(results[0].toleaf || 0);
                    callback(null, connection);
                }
            });
        }

        function selectIparty(connection, callback) {
            var select = "select nickname, totalleaf, " +
                sqlAes.decrypt("google_name", true) +
                "from iparty " +
                "where id = ?";
            connection.query(select, [req.user.id], function(err, results) {
                if(err) {
                    connection.release();
                    callback(err);
                } else {
                    totalleaf = results[0].totalleaf;
                    var message = {
                        "result" : {
                            "gName" : results[0].google_name,
                            "nickname" : (!results[0].nickname)? results[0].name : results[0].nickname,
                            "totalLeaf" : results[0].totalleaf,
                            "todayLeaf" : (todayleaf - resentleaf)
                        }
                    };
                    callback(null, message, connection);
                }
            });
        }

        function controlLeafPhoto (message, connection, callback) {
            var leafphotoId = 0;
            if (todayleaf >= 1000) {
                leafphotoId = 11;
            } else if (todayleaf >= 900) {
                leafphotoId = 10;
            } else if (todayleaf >= 800) {
                leafphotoId = 9;
            } else if (todayleaf >= 700) {
                leafphotoId = 8;
            } else if (todayleaf >= 600) {
                leafphotoId = 7;
            } else if (todayleaf >= 500) {
                leafphotoId = 6;
            } else if (todayleaf >= 400) {
                leafphotoId = 5;
            } else if (todayleaf >= 300) {
                leafphotoId = 4;
            } else if (todayleaf >= 200) {
                leafphotoId = 3;
            } else if (todayleaf >= 100) {
                leafphotoId = 2;
            } else {
                leafphotoId = 1;
            }
            var sql = "select photourl " +
                "from photos " +
                "where refer_type = 5 and refer_id = ?";
            connection.query(sql, [leafphotoId], function (err, results) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    message.result.treeUrl = results[0].photourl;
                    callback(null, message, connection);
                }
            });
        }

        function selectDaddress(message, connection, callback) {
            var select ="SELECT "+ sqlAes.decrypt("receiver") + sqlAes.decrypt("phone") + sqlAes.decrypt("add_phone") + "ad_code, " + sqlAes.decrypt("address", true) +
                "FROM daddress "+
                "where iparty_id = ? " +
                "order by id desc limit 1 ";
            connection.query(select, [req.user.id], function(err, results) {
                connection.release();
                if(err) {
                    callback(err);
                } else {
                    if(results.length) {
                        message.result.address = {
                            "gName" : results[0].receiver,
                            "dPhone1" : results[0].phone,
                            "dPhone2" : results[0].add_phone,
                            "dAdcode" : results[0].ad_code,
                            "dAddress" : results[0].address
                        };
                        callback(null, message);
                    } else {
                        message.result.address = {
                            "message" : "배송정보가 아직 입력되지 않았습니다."
                        };
                        callback(null, message);
                    }

                }
            });
        }

        //function selectLeafhistory(message, connection, callback) {
        //    var select = "select sum(changedamount) as chdamt "+
        //                 "from leafhistory "+
        //                 "where leaftype = 1 and iparty_id = ? and applydate = date(now())";
        //    connection.query(select, [req.user.id], function(err, results) {
        //        connection.release();
        //        if(err) {
        //            callback(err);
        //        } else {
        //            message.result.todayLeaf = (todayleaf - (isNaN(results[0].chdamt)?0:results[0].chdamt));
        //            callback(null, message);
        //        }
        //    });
        //}

        async.waterfall([getConnection, selectLeaf, selectIparty, controlLeafPhoto, selectDaddress], function(err, message) {
            if(err) {
                err.code = "err002";
                err.message = "내 정보를 불러올 수 없습니다...";
                logger.log('error', err);
                next(err);
            } else {
                logger.log('info', req.user.nickname+'님 배송지 변경');
                logger.log('info', message);
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
                logger.log('error', err);
                next(err);
            } else {
                logger.log('info', req.user.nickname+'님 정보를 변경하였습니다.');
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
                    if(results.length) {
                        var message = {
                            "result": {
                                "page": page,
                                "listPerPage": limit,
                                "list": []
                            }
                        };
                        async.eachSeries(results, function(result, callback) {
                            message.result.list.push({
                                "leafType": result.leaftype,
                                "leafApplydate": result.GMT9,
                                "leafChangedamount": result.changedamount
                            });
                            callback(null);
                        }, function(err) {
                            if(err) {
                                callback(err);
                            } else {
                                callback(null, message);
                            }
                        });
                    } else {
                        var message = {
                            "result": "나뭇잎 적립 내역이 없습니다."
                        };
                        callback(null, message);
                    }
                }
            });
        }

        async.waterfall([getConnection, selectLeafhistory], function(err, message) {
            if(err) {
                err.code = "err004";
                err.message = "나뭇잎 사용내역을 조회할 수 없습니다...";
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
        var select = "SELECT c.id as cartId, greenitems_id, p.photourl as picture, i.name as name, i.price as price, c.quantity as quantity, (c.quantity * i.price) as iprice " +
            "FROM cart c join greenitems i on (c.greenitems_id = i.id) " +
            "join (select refer_id, photourl " +
            "from photos " +
            "where refer_type = 3) p " +
            "on (i.id = p.refer_id) " +
            "where iparty_id = ?";
        connection.query(select, [req.user.id], function(err, results) {
           connection.release();
            if(err) {
                callback(err);
            } else {

                var message = {
                    "result" : {
                        "items" : [],
                        "totalPrice" : 0
                    }
                };

                var totalprice = 0;
                async.eachSeries(results, function(result, callback) {
                    message.result.items.push({
                        "cartId" : result.cartId,
                        "itemId": result.greenitems_id,
                        "picture": result.picture,
                        "name": result.name,
                        "price": result.price,
                        "quantity": result.quantity,
                        "iPrice": result.iprice
                    });
                    totalprice += result.iprice;
                    callback(null);
                }, function(err) {
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
            err.code = "err023";
            err.message = "장바구니를 사용할 수 없습니다...";
            logger.log('error', err);
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
        async.eachSeries(iid, function(element, callback) {
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
        }, function(err) {
            if(err) {
                callback(err);
            } else {
                connection.release();
                index = 0;
                callback(null);
            }
        });
    }

    async.waterfall([getConnection, insertCart], function(err, result) {
        if(err) {
            err.code = "err024";
            err.message = "장바구니에 물건 추가를 실패하였습니다...";
            logger.log('error', err);
            next(err);
        } else {
            logger.log('info', req.user.nickname+'님 장바구니에 물품 추가.');
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
        qt.push(parseInt(quantity));
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
            async.eachSeries(cid, function(element, callback) {
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
            }, function(err) {
                if(err) {
                    callback(err);
                } else {
                    connection.release();
                    callback(null);
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
            err.code = "err025";
            err.message = "장바구니에 있는 물품 수정에 실패하였습니다...";
            logger.log('error', err);
            next(err);
        } else {
            logger.log('info', req.user.nickname+'님 장바구니 물품 수정.');
            res.json({
                "result": {
                    "message": "장바구니에 물품을 수정하였습니다."
                }
            });
        }
    });

});



module.exports = router;