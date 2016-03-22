var express = require('express');
var router = express.Router();
var async = require('async');
var fs = require('fs');
var formidable = require('formidable');
var util = require('util');
var path = require('path');
var AWS = require('aws-sdk');
var mime = require('mime');
var s3Config = require('../config/s3Config');
var logger = require('./logger');

/* GET home page. */
var a;
var data = [];


//todo 1: 글 제목, 내용, 파일, 배경을 받아온다.


function getConnection (callback) {
    pool.getConnection(function (err, connection) {
        if (err) {
            var err = "connection 에러가 발생하였습니다.";
            callback(err) ;
        } else {
            callback(null, connection);
        }
    });
}

function isLoggedIn(req, res, next) {
    if(!req.isAuthenticated()) {
        var err = new Error('로그인이 필요합니다...');
        err. status = 401;
        next(err);
    } else {
        next(null, {"message" : "로그인이 완료되었습니다..."});
    }
}


router.get('/', isLoggedIn, function (req, res, next) {
    var ediary_id = 0;
    var iparty_id = parseInt(req.user.id);
    var page = parseInt(req.query.page);
    page = (isNaN(page))? 1 : page;
    page = (page < 1)? 1 : page;

    var limit = 10;
    var offset = parseInt((page - 1) * 10);

    function selectMystories(connection, callback) {
        var sql = "SELECT e.id as id, e.title as title, e.wdatetime as wtime, " +
            "e.heart as heart, ifnull(r.rAmount,0) as rAmount " +
            "FROM e_diary e left join (select ediary_id, count(ediary_id) as rAmount " +
            "                          from reply group by ediary_id) r " +
            "               on (e.id = r.ediary_id) " +
            "WHERE e.iparty_id = ? order by id desc limit ? offset ?";
        connection.query(sql, [iparty_id, limit, offset], function (err, results) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                callback(null, results);
            }
        });
    };

    async.waterfall([getConnection, selectMystories], function (err, results) {
        if (err) {
            var err = {
                "code": "err011",
                "message": "MYSTORY를 불러올 수 없습니다."
            };
            logger.log('error', err);
        } else {
            var list = [];
            for(var i = 0; i< results.length; i++){
                list.push({
                    "id" : results[i].id,
                    "title": results[i].title,
                    "wtime": results[i].wtime,
                    "heart": results[i].heart,
                    "rAmount": results[i].rAmount
                });
            }
            var result = {
                "result": {
                    "page": page,
                    "listPerPage": limit,
                    "list": list
                }
            };
            res.json(result);
        }
    });
});


router.get('/:ediaryId', isLoggedIn, function (req, res, next) {
    var ediary_id = parseInt(req.params.ediaryId);
    var iparty_id = parseInt(req.user.id);

    function selectMystories(connection, callback) {
        var sql = "SELECT i.nickname as nickname, " +
            "b.photourl as backgroundUrl, " +
            "e.content as content, p.photourl as photoUrl " +
            "FROM e_diary e join (select id, nickname from iparty) i " +
            "on(e.iparty_id = i.id) " +
                //"left join (select ediary_id, count(ediary_id) as rAmount " +
                //           "from reply group by ediary_id) r " +
                //"on (e.id = r.ediary_id) " +
            "left join (select refer_id, photourl from photos where refer_type = 1) p " +
            "on (e.id = p.refer_id) " +
            "left join (select refer_id, photourl from photos where refer_type = 4) b " +
            "on (e.id = b.refer_id)  " +
            "WHERE e.iparty_id = ? and e.id = ?";
        connection.query(sql, [iparty_id, ediary_id], function (err, results) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                callback(null, results);
            }
        });
    };

    async.waterfall([getConnection, selectMystories], function (err, results) {
        var list;
        if (err) {
            var err = {
                "code": "err011",
                "message": "MYSTORY를 불러올 수 없습니다."
            };
            logger.log('error', err);
            next(err);
        } else {
            if(results.length === 0){
                var err = {
                    "code": "err011",
                    "message": "MYSTORY를 불러올 수 없습니다."
                };
                logger.log('error', err);
                next(err);
            } else {
                list = {
                    "nickname": results[0].nickname,
                    "backgroundUrl": results[0].backgroundUrl,
                    "content": results[0].content,
                    "photoUrl": results[0].photoUrl
                };
                var result = {
                    "result": {
                        "list": [list]
                    }
                };
                res.json(result);
            }

        }

    });
});



router.post('/', isLoggedIn, function(req, res, next) {
    var iparty_id = parseInt(req.user.id);
    var ediary_id = 0;
    var location = "";
    var originalFilename = "";
    var modifiedFilename = "";
    var photoType = "";
    var exceed = 0;

    function writeMystory(connection, callback) {
        if(req.headers['content-type'] === 'application/x-www-form-urlencoded') {
            var title = req.body.title;
            var content = req.body.content;
            var bgId = req.body.bgId;

            var sql = "insert into e_diary (iparty_id, title, content, wdatetime, background_id) " +
                "values (?, ?, ?, now(), ?)";
            connection.query(sql, [iparty_id, title, content, bgId], function (err, result) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    ediary_id = result.insertId;
                    callback(null, connection);
                }
            });
        } else {
            var form = new formidable.IncomingForm();
            form.uploadDir = path.join(__dirname, '../uploads');
            form.keepExtensions = true;
            form.multiples = true;

            form.parse(req, function (err, fields, files) {
                var file = files['photo'];
                logger.log('debug', '필즈 값 : ' + fields + ', 파일은 : ' + file);
                console.log('필즈 값 : ' + fields + ', 파일은 : ' + file);

                var mimeType = mime.lookup(path.basename(file.path));
                var s3 = new AWS.S3({
                    "accessKeyId" : s3Config.key,
                    "secretAccessKey" : s3Config.secret,
                    "region" : s3Config.region,
                    "params" : {
                        "Bucket" : s3Config.bucket,
                        "Key" : s3Config.imageDir + "/" + path.basename(file.path),
                        "ACL" : s3Config.imageACL,
                        "ContentType": mimeType //mime.lookup
                    }
                });

                var body = fs.createReadStream(file.path);
                s3.upload({"Body": body}) //pipe역할
                    .on('httpUploadProgress', function (event) {
                        logger.log('info', event);
                    })
                    .send(function (err, data) {
                        if (err) {
                            callback(err);
                        } else {
                            location = data.Location;
                            originalFilename = file.name;
                            modifiedFilename = path.basename(file.path);
                            photoType = file.type;
                            fs.unlink(file.path, function () {
                                logger.log('info', files['photo'].path + " 파일이 삭제되었습니다...");
                            });
                            var sql = "insert into e_diary (iparty_id, title, content, wdatetime) " +
                                "values (?, ?, ?, now())";
                            connection.query(sql, [iparty_id, fields['title'], fields['content']], function (err, result) {
                                if (err) {
                                    connection.rollback();
                                    connection.release();
                                    callback(err);
                                } else {
                                    ediary_id = result.insertId;
                                    var sql2 = "insert into photos(photourl, uploaddate, originalfilename, modifiedfilename, " +
                                        "phototype, refer_type, refer_id) " +
                                        "values (?, now(), ?, ?, ?, 1, ?)";
                                    connection.query(sql2, [location, originalFilename, modifiedFilename, photoType, ediary_id], function (err, result) {
                                        if (err) {
                                            connection.rollback();
                                            connection.release();
                                            callback(err);
                                        } else {
                                            var photoId = result.insertId;
                                            logger.log('info', '생성된 사진 번호 : ' + photoId);
                                            callback(null, connection);
                                        }
                                    });
                                }
                            });
                        }
                    });
            });
        }
    }

    function saveLeaf(connection, callback) {
        connection.beginTransaction(function (err) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                var userLeaf = 0;
                function selectTodayLeaf(callback) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        var sql = "select sum(changedamount) as tLeaf " +
                            "from leafhistory " +
                            "where leaftype = 1 and iparty_id = ? and to_days(date_format(CONVERT_TZ(applydate, '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s')) = " +
                            "                                         to_days(date_format(CONVERT_TZ(now(), '+00:00', '+9:00'), '%Y-%m-%d %H:%i:%s'))";

                        connection.query(sql, [iparty_id], function (err, results) {
                            if (err) {
                                connection.release();
                                callback(err);
                            } else {
                                tLeaf = results[0].tLeaf;
                                logger.log('info', req.user.nickname+"님 오늘 획득 한 총 나뭇잎 개수 : " + tLeaf);
                                callback(null, tLeaf);
                            }
                        });


                    }
                }

                function insertLeaf(callback) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        if (tLeaf >= 15) {
                            //connection.release();
                            //var err = {"message": "오늘의 나뭇잎 충전량을 초과하였습니다."};
                            //next(err);
                            //callback(null, result);
                            exceed = 1;
                            callback(null);
                        } else {
                            var sql = "insert into leafhistory (applydate, leaftype, changedamount, iparty_id) " +
                                "values (now(), 1, 5, ?)";
                            connection.query(sql, [iparty_id], function (err, result) {
                                if (err) {
                                    connection.rollback();
                                    connection.release();
                                    callback(err);
                                } else {
                                    var leafId = result.insertId;
                                    logger.log('info', "생성된 leaf_ID : " + leafId);
                                    callback(null);
                                }


                            });
                        }
                    }
                }

                function selectUserLeaf(callback) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        var sql = "select sum(changedamount) as tLeaf " +
                            "from leafhistory " +
                            "where iparty_id = ?";
                        connection.query(sql, [iparty_id], function (err, result) {
                            if (err) {
                                connection.release();
                                callback(err);
                            } else {
                                userLeaf = result[0].tLeaf;
                                logger.log('info', req.user.nickname+"님의 총 나뭇잎 개수 " + userLeaf);
                                callback(null);
                            }
                        })
                    }

                }

                function updateUserLeaf(callback) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        var sql = "update iparty " +
                            "set totalleaf = ? " +
                            "where id = ?";
                        connection.query(sql, [userLeaf, iparty_id], function (err, result) {
                            if (err) {
                                connection.rollback();
                                connection.release();
                                callback(err);
                            } else {
                                connection.commit();
                                connection.release();
                                logger.log("현재 보유한 나뭇잎의 업데이트가 완료되었습니다.");
                                callback(null);
                            }
                        });
                    }
                }

                async.series([selectTodayLeaf, insertLeaf, selectUserLeaf, updateUserLeaf], function (err, result) {
                    if (err) {
                        logger.log('error', err);
                        callback(err);
                    } else {
                        callback(null, result);
                    }
                });


            }
        });
    }

    async.waterfall([getConnection, writeMystory, saveLeaf], function (err, results) {
        if (err) {
            var err = {
                "code": "err011",
                "message": "MYSTORY를 작성할 수 없습니다."
            };
            logger.log('error', err);
            next(err);
        } else if (exceed) {
            res.json({
                "result" : {
                    "message" : "글은 쓰셨지만 충전량을 초과했기 때문에 적립하지는 않았습니다."
                }
            });
        } else {
            logger.log('info', req.user.nickname+'님 글작성 후 나뭇잎 획득');
            var results = {
                "result": {
                    "ediaryId": results.insertId,
                    "message": "쓰기가 완료되었습니다."
                }
            };
            res.json(results);
        }
    });

});


router.put('/:ediaryId', isLoggedIn, function(req, res, next) {
    var iparty_id = parseInt(req.user.id); //실제로는 인증정보에서 가져옴
    var ediary_id = parseInt(req.params.ediaryId);

    var form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, '../uploads');
    form.keepExtensions = true;
    form.multiples = true;

    form.parse(req, function (err, fields, files) {
        var file = files['photo'];
        if (file === undefined) {
            if (fields['bgId'] === undefined) {
                function emptyUpdate (connection, callback) {
                    var sql = "update e_diary " +
                        "set title = ?, content = ?, wdatetime = now() " +
                        "where iparty_id = ? and id = ?";
                    connection.query(sql, [fields['title'], fields['content'], iparty_id, ediary_id], function (err, result) {
                        if (err) {
                            connection.release();
                            callback(err);
                        } else {
                            callback(null);
                        }
                    });
                }

                async.waterfall([getConnection, emptyUpdate], function (err, results) {
                    if (err) {
                        var err = {
                            "code" : "err012",
                            "message" : "Mystory를 수정할 수 없습니다."
                        }
                        next(err);
                    } else {
                        res.json("수정이 완료되었습니다.(emptyupdate)");
                    }
                });

            } else {
                function bgUpdate (connection, callback) {
                    var sql = "update e_diary " +
                        "set title = ?, content = ?, wdatetime = now(), background_id = ? " +
                        "where iparty_id = ? and id = ?";
                    connection.query(sql, [fields['title'], fields['content'], fields['bgId'], iparty_id, ediary_id], function (err, result) {
                        if (err) {
                            connection.release();
                            callback(err);
                        } else {
                            callback(null);
                        }
                    })
                }
                async.waterfall([getConnection, bgUpdate], function (err, results) {
                    if (err) {
                        var err = {
                            "code" : "err012",
                            "message" : "Mystory를 수정할 수 없습니다."
                        }
                        next(err);
                    } else {
                        res.json("수정이 완료되었습니다.(bgupdate)");
                    }
                })

            }

        } else {
            function deleteS3Photo(connection, callback) {
                var sql = "select modifiedfilename " +
                    "from photos " +
                    "where refer_type = 1 and refer_id = ?";
                connection.query(sql, [ediary_id], function (err, results) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else if (results.length === 0) {
                        logger.log('info', "사진이 존재하지 않습니다.");
                        callback(null, connection);
                    } else {
                        logger.log('info', '수정할 파일명: ' + results[0].modifiedfilename);
                        var s3 = new AWS.S3({
                            "accessKeyId": s3Config.key,
                            "secretAccessKey": s3Config.secret,
                            "region": s3Config.region
                        });
                        var params = {
                            "Bucket": s3Config.bucket,
                            "Key": s3Config.imageDir + "/" + results[0].modifiedfilename
                        };
                        s3.deleteObject(params, function (err, data) {
                            if (err) {
                                connection.release();
                                logger.log('error', err, err.stack);
                            } else {
                                logger.log('info', data);
                                callback(null, connection);
                            }
                        });
                    }
                })
            }

            function updateMystory(connection, callback) {
                var mimeType = mime.lookup(path.basename(file.path));
                var s3 = new AWS.S3({
                    "accessKeyId": s3Config.key,
                    "secretAccessKey": s3Config.secret,
                    "region": s3Config.region,
                    "params": {
                        "Bucket": s3Config.bucket,
                        "Key": s3Config.imageDir + "/" + path.basename(file.path),
                        "ACL": s3Config.imageACL,
                        "ContentType": mimeType //mime.lookup
                    }
                });

                var body = fs.createReadStream(file.path);
                s3.upload({"Body": body}) //pipe역할
                    .on('httpUploadProgress', function (event) {
                        logger.log('info', event);
                    })
                    .send(function (err, data) {
                        if (err) {
                            logger.log('error', err);
                            callback(err);
                        } else {
                            logger.log('info', "데이터의 정보 " + data);
                            location = data.Location;
                            originalFilename = file.name;
                            modifiedFilename = path.basename(file.path);
                            photoType = file.type;
                            fs.unlink(file.path, function () {
                                logger.log('info', files['photo'].path + " 파일이 삭제되었습니다...");
                            });
                            var sql = "update e_diary " +
                                "set title = ?, content = ?, wdatetime = now() " +
                                "where iparty_id = ? and id = ?";
                            connection.query(sql, [fields['title'], fields['content'], iparty_id, ediary_id], function (err, result) {
                                if (err) {
                                    connection.rollback();
                                    connection.release();
                                    callback(err);
                                } else {
                                    var sql2 = "update photos " +
                                        "set photourl = ?, uploaddate = now(), originalfilename = ?, modifiedfilename = ?, photoType = ? " +
                                        "where refer_type = 1 and refer_id = ?";
                                    connection.query(sql2, [location, originalFilename, modifiedFilename, photoType, ediary_id], function (err, result) {
                                        if (err) {
                                            connection.rollback();
                                            connection.release();
                                            callback(err);
                                        } else {
                                            connection.commit();
                                            connection.release();
                                            var photoId = result.insertId;
                                            logger.log("생성된 사진 번호 : " + photoId);
                                            callback(null, connection);
                                        }
                                    });
                                }
                            });
                        }
                    });
            }

            async.waterfall([getConnection, deleteS3Photo, updateMystory], function (err, results) {
                if (err) {
                    var err = {
                        "code" : "err012",
                        "message" : "Mystory를 수정할 수 없습니다."
                    };
                    logger.log('error', err);
                    next(err);
                } else {
                    res.json("수정이 완료되었습니다.(updateMystory)");
                }
            })


        }
    });
});




module.exports = router;
