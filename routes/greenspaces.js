var express = require('express');
var router = express.Router();
var url = require('url');
var util = require('util');

router.get('/', function(req, res, next){
    var urlObj = url.parse(req.url);
    console.log(util.inspect(urlObj));
});

module.exports = router;