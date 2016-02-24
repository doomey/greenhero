var express = require('express');
var router = express.Router();

router.post('/', function(req, res, next) {
    if(req.secure) {
        res.json({
            "result" : {
                "message" : "로그인이 완료 되었습니다. 감사합니다!"
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
        res.json({
            "result" : {
                "gName" : "송병훈",
                "nickname" : "아재개그1인자",
                "totalLeaf" : 50000,
                "todaysLeaf" : 45,
                "address" : {
                    "dName" : "송병훈",
                    "dPhone1" : "010-1234-5678",
                    "dPhone2" : "010-4321-8765",
                    "dAdcode" : "12345",
                    "dAddress" : "춘천"
                }
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
        res.json({
            "result" : {
                "message" : "내 정보가 수정되었습니다."
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
        if(err) {
            var err = new Error('나뭇잎 사용내역을 조회할 수 없습니다...');
            err.code = "err004";
            res.json(err);
        } else {
            res.json({
                "result" : {
                    "page" : 1,
                    "listPerPage" : 2,
                    "list" : [{
                        "leafType" : 0,
                        "leafApplydate" : "2016-02-23",
                        "leafChangedamount" : 1000
                    },
                        {
                            "leafType" : 1,
                            "leafApplydate" : "2016-02-23",
                            "leafChangedamount" : 500
                        }]
                }
            });
        }
    } else {

    }
});

router.get('/me/bells', function(req, res, next) {
    if(err) {
        var err = new Error('알람종을 불러올 수 없습니다.');
        err.code = "err005";
        res.json(err);
    } else {
        res.json({
            "result" : {
                "heartInfo" : [{
                    "nickname" : "송병",
                    "id" : 1,
                    "replyId" : 1,
                    "message" : "춘천막국수님이 내 글을 추천했습니다.",
                    "heartDate" : "2016-02-23"
                }],
                "replyInfo" : [{
                    "nickname" : "병훈",
                    "id" : 1,
                    "replyId" : 2,
                    "message" : "춘천닭갈비님이 내 글에 댓글을 달았습니다.",
                    "replyDate" : "2016-02-23"
                }]
            }
        });
    }

});

router.get('/me/baskets', function(req, res, next) {
    if (req.secure) {
        res.json({
            "result": {
                "items": [{
                    "id": 1,
                    "picture": "/photos/xxxxxxxxxx.jpg",
                    "name": "하기스",
                    "price": 1000,
                    "quantity": 1,
                    "iPrice": 1000
                }, {
                    "id": 2,
                    "picture": "/photos/xxxxxxx.jpg",
                    "name": "팬티",
                    "price": 500,
                    "quantity": 3,
                    "iprice": 1500
                }],
                "totalPrice": 2500
            }
        });
    } else {
        var err = new Error("SSL/TLS Upgrade Required");
        err.status = 426;
        next(err);
    }
});

router.post('/me/baskets', function(req, res, next) {
    res.json({
        "result" : {
            "message" : "장바구니에 물품을 추가하였습니다."
        }
    });
});

router.put('/me/baskets', function(req, res, next) {
    res.json({
        "result" : {
            "message" : "장바구니에 물품을 수정하였습니다."
        }
    });
});


router.get('/me/baskets', function(req, res, next){

        res.json({
            "result": {
                "items": [
                    {
                        "id": 1,
                        "picture": "/photos/xxxxxxxxx.jpg",
                        "name": "기저귀",
                        "price": 200,
                        "quantity": 1,
                        "iPrice": 200
                    },
                    {
                        "id": 2,
                        "picture": "/photos/xxxxyyyyxxx.jpg",
                        "name": "휴지",
                        "price": 300,
                        "quantity": 2,
                        "iPrice": 600
                    }
                ],
                "totalPrice": 800
            }
        });
});

router.post('/me/baskets', function(req, res, next){

        res.json({
            "result": {
                "message": "장바구니에 물품을 추가하였습니다."
            }
        });
});

router.put('/me/baskets', function(req, res, next){
        res.json({
            "result": {
                "message": "장바구니에 물품을 수정하였습니다."
            }
        });
});

module.exports = router;