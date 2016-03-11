var express = require('express');
var router = express.Router();
var async = require('async');
var sqlAes = require('./sqlAES.js');

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

router.post('/', isLoggedIn, function(req, res, next) {
        if(req.secure) {
            //물건의 id와 수량을 받아옴
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

            //주문자의 배송관련 정보
            var name = req.body.name;
            var phone1 = req.body.phone1;
            var phone2 = req.body.phone2;
            var adcode = req.body.adcode;
            var address = req.body.address;
            var care = req.body.care;

            function getConnection(callback) {
                pool.getConnection(function(err, connection) {
                   if(err) {
                       callback(err);
                   }  else {
                       callback(null, connection);
                   }
                });
            }

            function selectIparty(connection, callback) {
                var select = "select google_id as gid, google_name as gname, google_email, " +
                             //"convert(aes_decrypt(phone, unhex(" + connection.escape(serverKey) + ")) using utf8), " +
                             sqlAes.decrypt("phone") +
                             "totalleaf "+
                             "from iparty "+
                             "where id = ?";
                connection.query(select, [req.user.id], function(err, results) {
                    if(err) {
                        connection.release();
                        callback(err);
                    } else {
                        var message = {
                            "result" : {
                                "message" : "주문에 성공하였습니다.",
                                "orderId" : 0,
                                "items" : [],
                                "totalPrice" : 0,
                                "oInfo" : {
                                    "id" : results[0].gid,
                                    "name" : results[0].gname,
                                    "email" : results[0].google_email,
                                    "phone" : results[0].phone
                                },
                                "aInfo" : {
                                    "name" : name,
                                    "phone1" : phone1,
                                    "phone2" : phone2,
                                    "adCode" : adcode,
                                    "address" : address,
                                    "care" : care
                                }
                            }
                        };
                        callback(null, results[0].totalleaf, message, connection);
                    }
                });
            }


            function doTransaction(totalleaf, message, connection, callback) {
                connection.beginTransaction(function(err) {
                    if(err) {
                        connection.release();
                        callback(err);
                    }

                    //1. greenitems테이블에서 물품id별로 select
                    function selectGreenitems(callback) {
                        var select = "select id, name, picture, price "+
                                     "from greenitems "+
                                     "where id in (?)";
                        connection.query(select, [iid], function(err, results) {
                            if(err) {
                                connection.release();
                                callback(err);
                            } else {
                                var index = 0;
                                var TP = 0;
                                async.each(results, function(element, callback) {
                                    message.result.items.push({
                                        "id" : element.id,
                                        "name" : element.name,
                                        "picture" : element.picture,
                                        "price" : element.price,
                                        "quantity" : qt[index]
                                    });
                                    TP += element.price * qt[index];
                                    index++;
                                    callback(null);
                                }, function(err, result) {
                                    if(err) {
                                        connection.release();
                                        callback(err);
                                    } else {
                                        index = 0;
                                        message.result.totalPrice = TP;
                                        callback(null, message, TP);
                                    }
                                });
                            }
                        });
                    }

                    //2. orders테이블에 insert -> 물품의 총 가격이 totalleaf보다 높으면 rollback
                    function insertOrders(message, TP, callback) {
                        //sqlAes.set(connection, serverKey);
                        var insert =  "insert into orders(iparty_id, date, receiver, phone, addphone, adcode, address, care) "+
                                      //"values(?, date(now()), ?, ?, ?, ?, ?, ?)";
                                      "values(?, date(now()), " +
                                      sqlAes.encrypt(6)
                                      //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")), " +
                                      //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")), " +
                                      //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")), " +
                                      //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")), " +
                                      //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")), " +
                                      //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + "))" +
                                       + ")";
                        connection.query(insert, [req.user.id, name, phone1, phone2, adcode, address, care], function(err, result) {
                            if(err) {
                                connection.rollback();
                                connection.release();
                                callback(err);
                            } else {
                                if(totalleaf < TP) {
                                    connection.rollback();
                                    connection.release();
                                    var err = new Error('보유한 나뭇잎이 주문한 물건의 금액보다 작습니다.');
                                    err.code = "err027";
                                    next(err);
                                } else {
                                    //iparty테이블의 사용자의 totalleaf를 totalleaf-TP로 update
                                    var update = "update iparty "+
                                                 "set totalleaf = ? "+
                                                 "where id = ?";
                                    connection.query(update, [(totalleaf-TP), req.user.id], function(err) {
                                        if(err) {
                                            connection.rollback();
                                            connection.release();
                                            callback(err);
                                        }
                                    });
                                    message.result.orderId = result.insertId;
                                    callback(null, message, result.insertId, TP);
                                }
                            }
                        });
                    }
                    //3. orderdetails테이블에 물품id별로 insert
                    function insertOrderdetails(message, orderId, TP, callback) {
                        var index = 0;
                        async.each(iid, function (element, callback) {
                            var insert = "insert into orderdetails(order_id, quantity, greenitems_id) " +
                                "values(?, ?, ?)";
                            connection.query(insert, [orderId, qt[index], element], function (err, result) {
                                if (err) {
                                    connection.release();
                                    callback(err);
                                } else {

                                }
                            });
                            index++;
                            callback(null);
                        }, function (err, result) {
                            if (err) {
                                connection.rollback();
                                connection.release();
                            } else {
                                index = 0;
                                callback(null, message, TP);
                            }
                        });
                    }
                    //4. leafhistory테이블에서 총 구매량insert
                    function insertLeafhistory(message, TP, callback) {
                        var insert = "insert into leafhistory(applydate, leaftype, changedamount, iparty_id) "+
                                     "values(date(now()), 0, ?, ?)";
                        connection.query(insert, [TP, req.user.id], function(err, result) {
                            if(err) {
                                callback(err);
                            } else {
                                callback(null, message);
                            }
                        });
                    }

                    async.waterfall([selectGreenitems, insertOrders, insertOrderdetails, insertLeafhistory], function(err, message) {
                        if(err) {
                            connection.rollback();
                            callback(err);
                        } else {
                            connection.commit();
                            connection.release();
                            callback(null, message);
                        }
                    });
                })
            }
            async.waterfall([getConnection, selectIparty, doTransaction], function(err, message) {
                if(err) {
                    err.code = "err015";
                    err.message = "주문실패. 목록을 불러올 수 없습니다.";
                    next(err);
                } else {
                    res.json(message);
                }
            });
    } else {
        var err = new Error('SSL/TLS Upgreade Required...');
        err.status = 426;
        next(err);
    }

    });

router.post('/setaddress', function(req, res, next) {
    if(req.secure) {
        var name = req.body.name;
        var phone1 = req.body.phone1;
        var phone2 = req.body.phone2;
        var adcode = req.body.adcode;
        var address = req.body.address;

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if(err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            })
        }

        function insertDaddress(connection, callback) {
            var insert =  "insert into daddress(ad_code, iparty_id, name, receiver, phone, add_phone, address) "+
                          "values(?, ?, " +
                          sqlAes.encrypt(5)
                          //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")), " +
                          //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")), " +
                          //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")), " +
                          //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")), " +
                          //"aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")), " +
                          + ")";
            connection.query(insert, [adcode, req.user.id, req.user.name, name, phone1, phone2, address], function(err, result) {
               connection.release();
                if(err) {
                   callback(err);
               } else {
                    var message = {
                        "result" : {
                            "message" : "주소가 등록되었습니다."
                        }
                    };
                    callback(null, message);
                }
            });
        }
        async.waterfall([getConnection, insertDaddress], function(err, message) {
            if(err) {
                err.code = "err016";
                err.message = "주소 등록에 실패하였습니다...";
                next(err);
            } else {
                res.json(message);
            }
        });

    } else {
        var err = new Error('SSL/TLS Upgreade Required...');
        err.status = 426;
        next(err);
    }

});

module.exports = router;