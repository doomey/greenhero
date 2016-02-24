var express = require('express');
var router = express.Router();
var async = require('async');

router.post('/', function(req, res, next) {
        if(req.secure) {
        res.json(
            {
                "result" : {
                    "message" : "주문에 성공하였습니다",
                        "orderId" : 1,
        "items" : [{
            "id" : 1,
            "name" : "하기스",
            "picture" : "/photos/xxxxxxx.jpg",
            "price" : 1000,
            "quantity" : 1
    }],
        "totalPrice" : 1000,
            "oInfo" : {
            "id" : 1,
                "name" : "송병훈",
                "email" : "kirsch2u@naver.com",
                "Phone" : "010-1234-5678"
        },
        "aInfo" : {
            "name" : "병훈송",
                "phone1" : "010-1234-5678",
                "phone2" : "011-1234-5678",
                "adCode" : "12345",
                "address" : "춘천"
        }
    }
    }
        );
    } else {
        var err = new Error('SSL/TLS Upgreade Required...');
        err.status = 426;
        next(err);
    }

    });

router.post('/setaddress', function(req, res, next) {
    if(req.secure) {
        res.json({
        "result" : {
        "message" : "주소가 등록되었습니다."
        }
    });
    } else {
        var err = new Error('SSL/TLS Upgreade Required...');
        err.status = 426;
        next(err);
    }


});
module.exports = router;