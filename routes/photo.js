var express = require('express');
var router = express.Router();

router.get('/:photo_id', function(req, res, next) {
    var photoId = req.params;

    res.json({
        "result": {
            "message" : "사진을 가져왔습니다."
        }
    });
});

module.exports = router;