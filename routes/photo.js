var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var mime = require('mime');

router.get('/:photo_id', function(req, res, next) {
    var fileName = req.params.photo_id;
    var pathObj = path.parse(__dirname);
    var filePath = path.join(pathObj.dir, '/public/photos', fileName);

    fs.stat(filePath, function(err, stats){
        if(err){
            var err = {
                "code" : "err025",
                "message" : "사진 불러오기에 실패하였습니다."
            }
            next(err);
        } else {
            var reader = fs.createReadStream(filePath);
            var mimeType = mime.lookup(fileName);
            res.writeHead(200,{'content-type' : mimeType});
            res.pipe(reader);
        }
    });
});

module.exports = router;