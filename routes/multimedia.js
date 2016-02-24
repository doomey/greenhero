var express = require('express');
var router = express.Router();

router.get('/:multimedia_id', function(req, res, next) {
    var multimediaId = req.params;
    res.json({
        "result": {
            "message" : "동영상을 가져왔습니다."
        }
    });
});

module.exports = router;