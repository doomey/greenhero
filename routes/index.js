var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  if(req.secure){
    res.render('index', { title: 'Express' });
  } else {
    var err = new Error('https required!');
    err.status = 426;
    next(err);
  }
});

module.exports = router;
