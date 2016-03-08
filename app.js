var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var passport = require('passport');

global.pool = require('./config/dbpool');
global.serverKey = process.env.GREEN_SERVER_KEY;
require('./config/passportconfig')(passport); //passport를 configuration



var accessterms = require('./routes/accessterms');
var bell = require('./routes/bell');
var faqs = require('./routes/faqs');
var greenplayer = require('./routes/greenplayer');
var greenspace = require('./routes/greenspace');
// 중요!!! Loading router-level middleware modules 라우터 레벨 미들웨어 모듈을 로딩한다.
var index = require('./routes/index');



var notices = require('./routes/notices');


var policies = require('./routes/policies');


//Green Space 라우팅 모듈 로딩


//greep Player 라우팅 모듈 로딩


//items 라우팅 모듈 로딩
var items = require('./routes/items');

//members 라우팅 모듈 로딩
var members = require('./routes/member');

var orders = require('./routes/orders');
var receipt = require('./routes/receipt');



var mystory = require('./routes/mystory');

var migration = require('./routes/migration');

var app = express();

//로컬
var local = require('./routes/local');

var upload = require('./routes/uploading_photo');

app.set('env', 'development');
//app.set('env', 'production');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  "secret" : process.env.GREEN_SERVER_KEY,
  //"secret" : "8/ETEX3IKHEWqcTzFNxzjte3UlelHroD4yrYHk0kR8U=", //cmd > openssl rand -base64 32 명령으로 생성한 임의값
  //원래 secret은 process.env.server_key 이런 식으로 OS 환경변수에 넣어 사용하고 키값을 직접 적지는 않는다.
  "cookie" : {"maxAge" : 86400000}, // 1000ms * 60초 * 60분 * 24시간. 하루동안 세션을 유지하겠다.
  "resave" : true,
  "saveUninitialized" : true
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(passport.session());
// 중요!!! mapping mount point configuration. 마운트 포인트를 구성하면 된다.
app.use('/', index);

//공지사항, FAQ, 이용약관, 운영정책 라우팅 모듈을 특정 라우팅 경로에 등록
app.use('/notices', notices);
app.use('/faqs', faqs);
app.use('/accessterms', accessterms);
app.use('/policies', policies);

//Green space 라우팅 모듈을 특정 라우팅 경로에 등록
app.use('/greenspaces', greenspace);

//greep Player 라우팅 모듈을 특정 라우팅 경로에 등록
app.use('/greenplayer', greenplayer);

//items 라우팅 모듈을 특정 라우팅 경로에 등록
app.use('/items', items);

//members 라우팅 모듈을 특정 라우팅 경로에 등록
app.use('/members', members);

app.use('/orders', orders);
app.use('/receipt', receipt);
app.use('/bells/me', bell);


app.use('/mystories', mystory);

//로컬
app.use('/local', local);

app.use('/upload', upload);

app.use('/migration', migration);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json('error', {
      error : {
        code : err.code,
        message: err.message
      }
    });
  });
}

app.use(function(err, req, res, next) {
  res.json({
    message: err.message,
    error: {}
  });
});

module.exports = app;
