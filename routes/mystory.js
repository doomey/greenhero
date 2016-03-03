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
/* GET home page. */

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
    var page = req.query.page;
    var limit = 10;
    var offset = parseInt((page - 1) * 10);

    function selectMystories(connection, callback) {
        var sql = "SELECT e.id as id, e.title as title, i.nickname as nickname, e.wdatetime as wtime, " +
                         "e.heart as heart, ifnull(r.rAmount,0) as rAmount, e.background_id as backgroundId, " +
                         "e.content as content, p.photourl as photoUrl " +
                  "FROM e_diary e join (select id, nickname from iparty) i on(e.iparty_id = i.id) " +
                            "left join (select ediary_id, sum(ediary_id) as rAmount " +
                                       "from reply group by ediary_id) r " +
                                 "on (e.id = r.ediary_id) " +
                            "left join (select refer_id, photourl " +
                                       "from photos where refer_type = 1) p " +
                                 "on (e.id = p.refer_id) " +
                  "where e.iparty_id = ? order by id desc limit ? offset ?";
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
            }
        } else {
            var list = [];
            for(var i = 0; i< results.length; i++){
                list.push({
                    "id" : results[i].id,
                    "title": results[i].title,
                    "nickname": results[i].nickname,
                    "wtime": results[i].wtime,
                    "heart": results[i].heart,
                    "rAmount": results[i].rAmount,
                    "backgroundId": results[i].backgroundId,
                    "content": results[i].content,
                    "fileUrl": "/public/photos/" + results[i].fileUrl
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


router.post('/', isLoggedIn, function(req, res, next) {
    var iparty_id = parseInt(req.user.id); //실제로는 인증정보에서 가져옴
    var title = req.body.title;
    var content = req.body.content;
    var bgId = parseInt(req.body.bgId);
    var ediary_id = 0;
    var results;
    var location = "";
    var originalFilename = "";
    var modifiedFilename = "";
    var photoType = "";
    var conn;


    function writeMystory(connection, callback) {
        var form = new formidable.IncomingForm();
        form.uploadDir = path.join(__dirname, '../uploads');
        form.keepExtensions = true;
        form.multiples = true;

        form.parse(req, function (err, fields, files) {
            if (fields['bgId'] === undefined) {
                var file = files['photo'];
                console.log("파일의 내용 " + file.name);
                console.log("필드의 내용 " + fields);
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
                      console.log(event);
                  })
                  .send(function (err, data) {
                      if (err) {
                          console.log(err);
                          callback(err);
                      } else {
                          console.log("데이터의 정보 " + data);
                          location = data.Location;
                          originalFilename = file.name;
                          modifiedFilename = path.basename(file.path);
                          photoType = file.type;
                          fs.unlink(file.path, function () {
                              console.log(files['photo'].path + " 파일이 삭제되었습니다...");
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
                                          console.log(photoId);
                                          callback(null, connection);
                                      }
                                  });
                              }
                          });
                      }
                  });



            } else {
                var sql = "insert into e_diary (iparty_id, title, content, wdatetime, background_id) " +
                  "values (?, ?, ?, now(), ?)";
                connection.query(sql, [iparty_id, fields['title'], fields['content'], fields['bgId']], function (err, result) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        ediary_id = result.insertId;
                        callback(null, connection);
                    }
                });
            }
        });
    }

    function saveLeaf(connection, callback) {
        connection.beginTransaction(function (err) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                function selectTodayLeaf(callback) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        //todo 6 : 오늘 획득한 나뭇잎을 조회한다.
                        var sql = "select sum(changedamount) as tLeaf " +
                          "from leafhistory " +
                          "where date(applydate) = date(now()) and iparty_id = ? and leaftype = 1";
                        connection.query(sql, [iparty_id], function (err, results) {
                            if (err) {
                                connection.release();
                                callback(err);
                            } else {
                                tLeaf = results[0].tLeaf;
                                console.log("오늘 획득 한 총 나뭇잎 개수 : " + tLeaf);
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
                            connection.release();
                            var err = {"message": "오늘의 나뭇잎 충전량을 초과하였습니다."};
                            next(err);
                            //callback(null, result);
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
                                    console.log("생성된 leaf_ID : " + leafId);
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
                                console.log("사용자의 총 나뭇잎 개수 " + userLeaf);
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
                                console.log("업데이트가 완료되었습니다.");
                                callback(null);
                            }
                        });
                    }
                }

                async.series([selectTodayLeaf, insertLeaf, selectUserLeaf, updateUserLeaf], function (err, result) {
                    if (err) {
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
            }
            next(err);
        } else {
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


router.put('/:ediaryId', function(req, res, next) {
    var body = req.body.replyBody;
    var ediary_id = req.params.ediaryId;


    function updateReply(connection, callback) {
        var sql = "update reply " +
          "set body = ?, wdatetime = now() " +
          "where id = ? and iparty_id = ?";
        connection.query(sql, [body, reply_id, ediary_id], function (err, result) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                callback(null, {
                    "message" : "수정이 완료되었습니다."
                })
            }
        });
    }

    async.waterfall([getConnection, updateReply], function (err, result) {
        if (err) {
            var err = {
                "code" : "err009",
                "message" : "댓글을 수정할 수 없습니다."
            }
            next(err);
        } else {
            res.json(result);
        }
    })

});





module.exports = router;
