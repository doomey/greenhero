var express = require('express');
var router = express.Router();

function isLoggedIn(req, res, next) {
    if(!req.isAutenticated()) {
        var err = new Error('로그인이 필요합니다...');
        err. status = 401;
        next(err);
    } else {
        next(null, {"message" : "로그인이 완료되었습니다..."});
    }
}

router.post('/', isLoggedIn, function(req, res, next) {
    var nickname = req.body.nickname;
    var date = req.body.date;

    function getConnection(callback) {
        pool.getConnection(function(err, connection) {
            if(err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        })
    }

    function selectIparty(connection, callback) {
        var select = "select registration_token "+
            "from greendb.iparty "+
            "where nickname = ?";
        connection.querty(select, [1], function(err, results) {
            connection.release();
            if(err) {
                callback(err);
            } else {
                callback(null, results[0].registration_token);
            }
        });
    }

    async.waterfall([getConnection, selectIparty], function(err, registration_token) {
        if(err) {
            err.code = "err005";
            err.message = "알림종을 불러올 수 없습니다.";
            next(err);
        } else {
            var user = req.user;

            var server_access_key = 'AIzaSyBaFeq5YGUXdRQmmTLJV2MqmqciZV5AVQk';
            var sender = new gcm.Sender(server_access_key);
            var registrationIds = [];
            registrationIds.push(registration_token);

            var message = new gcm.Message({
                "collapseKey": 'demo',
                "delayWhileIdle": true,
                "timeToLive": 3,
                "data" : {
                    "who": nickname,
                    "message": "댓글누른사람닉네임"+"님이 공감하셨습니다!", //user.nickname으로 교체
                    "when": date
                }
            });

            sender.send(message, registrationIds, 4, function(err, result) {
                console.log(result);
            })

            sender.send(message, tokens, function(err, result) {
                if(err) {
                    next(err);
                } else {
                    result.results.forEach(function(item) {
                        if(item.message_id) {
                            console.log('success : '+item.message_id);
                        } else {
                            console.log('error : '+item.error);
                        }
                    });
                }
            });
        }
    });
});

module.exports = router;