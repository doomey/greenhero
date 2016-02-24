var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next){
    res.json({
        "result" : {
            "page" : 1,
            "itemsPerPage" : 10,
            "cartUrl" : "/members/me/baskets",
            "orderUrl" : "/orders",
            "items" : [{
                "id" : 1,
                "name" : "기저귀",
                "picture" : "/photos/xxxxxxxxx.jpg",
                "star" : 13,
                "price" : 200,
                "itemCount" : 10,
                "itemDescription" : "잘 안 찢어져요"
            }]
        }
    });
});

module.exports = router;