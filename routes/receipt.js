var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
    if(req.secure) {
            res.json({
                "result" : {
                    "page" : 1,
                    "itemsPerPage" : 2,
                    "items" : [{
                        "id" : 1,
                        "name" : "하기스",
                        "picture" : "/photos/xxxxxxx.jpg",
                        "price" : 1000,
                        "quantity" : 1,
                        "iPrice" : 1000,
                    }, {
                        "id" : 2,
                        "name" : "팬티",
                        "picture" : "/photos/xxxxxxx.jpg",
                        "price" : 500,
                        "quantity" : 2,
                        "iPrice" : 1000
                    }]
                }
            });
    } else {
        var err = new Error("SSL/TLS Upgrade Required");
        err.status = 426;
        next(err);
    }
})
module.exports = router;