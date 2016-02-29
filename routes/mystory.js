var express = require('express');
var router = express.Router();
var async = require('async');
var fs = require('fs');
var formidable = require('formidable');
var util = require('util');
var path = require('path');
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
router.get('/', function (req, res, next) {
    var iparty_id = req.query.ipartyId;
    var page = req.query.page;
    var limit = 10;
    var offset = parseInt((page - 1) * 10);
//
    res.writeHead(200, {'content-type': 'text/html; charset=UTF-8'});
    res.write('<html lang="ko"><head><title>파일업로드</title></head><body><ul>');
    data.forEach(function(article, index){
        res.write('<li>');
        res.write('<strong>'+article.title+'</strong>');
        article.picts.forEach(function(pict, index){
            res.write('<img width="200" height="160" src="' + path.join('/stars/images/', path.basename(pict.path)) + '">');
        });
        res.write('</li>');
    });
    res.write('</ul>');
    res.write('<div><form method="post" action="/mystories" enctype="multipart/form-data">'); //아래 form.type === urlencoded 조건문을 확인하려면
    //enctype="multipart/form-data" 문구를 삭제하고 테스트해보자.
    res.write('<div><label for="title">제목 : </label><input type="text" name="title"></div>');
    res.write('<div><label for="pict">파일 : </label><input type="file" name="pict" multiple="multiple"></div>'); //multiple : 2개 이상의 파일을 올릴 수 있는 옵션
    res.write('<div><input type="submit" value="업로드"></div>');
    res.write('</form></div></body></html>');
    res.end();
//

    function selectMystories(connection, callback) {
        var sql = "SELECT e.id as id, e.title as title, i.nickname as nickname, e.wdatetime as wtime, e.heart as heart, ifnull(r.rAmount,0) as rAmount, e.background_id as backgroundId, e.content as content, f.modifiedfilename as fileUrl " +
                  "FROM e_diary e join (select id, nickname " +
                                       "from iparty) i " +
                                 "on(e.iparty_id = i.id) " +
                  "left join (select ediary_id, sum(ediary_id) as rAmount " +
                             "from reply " +
                             "group by ediary_id) r " +
                       "on (e.id = r.ediary_id) " +
                  "left join (select refer_id, modifiedfilename " +
                             "from files " +
                             "where refer_type = 1) f " +
                       "on (e.id = f.refer_id) " +
                  "where e.iparty_id = ? " +
                  "order by id desc limit ? offset ?";
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


router.post('/', function(req, res, next) {
    var iparty_id = parseInt(req.body.ipartyId); //실제로는 인증정보에서 가져옴
    var title = req.body.title;
    var content = req.body.content;
    var file = req.body.file;
    var bgId = parseInt(req.body.bgId);



    var form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, '../public/photos'); //join은 normalize기능도 가지고 있다. 현재 디렉터리의 uploads 디렉터리 연결.
    form.keepExtensions = true; //uploadDir에 저장되는 파일 확장자를 유지할 것인지 선택. true면 확장자를 유지한다.
    form.multiples = false; //배열 객체로 변환한다.
    form.parse(req, function (err, fields, files) {
        if (err) {
            console.log(err);
            res.statusCode = 500;
            res.setHeader('content-type', 'text/plain; charset=UTF-8');
            res.end('업로드 중 문제가 발생했습니다.');
        } else {
            var fileName = files.pict.name;
            var fileSize = files.pict.size;
            var reNameFile = path.basename(files.pict.path);


            console.log(fileName);
            console.log(fileSize);
            console.log(reNameFile);
        }
        res.writeHead(200, {'content-type': 'text/html'});
        res.end(
            '<form action="/upload" enctype="multipart/form-data" method="post">'+
            '<input type="text" name="title"><br>'+
            '<input type="file" name="upload" multiple="multiple"><br>'+
            '<input type="submit" value="Upload">'+
            '</form>'
        );
    });






}); //

//
//    function writeMystory(connection, callback) {
//        if (!file) {
//            //todo 3 : 파일이 없을경우 배경넣어서 insert
//            var sql = "insert into e_diary (iparty_id, title, content, wdatetime, background_id) " +
//                "values (?, ?, ?, now(), ?)";
//            connection.query(sql, [iparty_id, title, content, bgId], function (err, result) {
//                if (err) {
//                    connection.release();
//                    callback(err);
//                } else {
//                    ediary_id = result.insertId;
//                    callback(null, connection);
//                }
//            });
//
//        } else {
//            //todo 4 : 파일이 있을경우 insert 후 파일 insert
//            var sql = "insert into e_diary (iparty_id, title, content, wdatetime) " +
//                "values (?, ?, ?, now())";
//            connection.query(sql, [iparty_id, title, content], function (err) {
//                if (err) {
//                    connection.release();
//                    callback(err);
//                } else {
//
//                    ediary_id = result.insertId;
//                    //todo 5 : 첨부 파일을 insert한다.
//                    callback(null, connection);
//                }
//            });
//
//        }
//    }
//
//
//    function saveLeaf(connection, callback) {
//        connection.beginTransaction(function (err) {
//            if (err) {
//                connection.release();
//                callback(err);
//            } else {
//                function selectTodayLeaf(callback) {
//                    if (err) {
//                        connection.release();
//                        callback(err);
//                    } else {
//                        //todo 6 : 오늘 획득한 나뭇잎을 조회한다.
//                        var sql = "select sum(changedamount) as tLeaf " +
//                            "from leafhistory " +
//                            "where date(applydate) = date(now()) and iparty_id = ? and leaftype = 1";
//                        connection.query(sql, [iparty_id], function (err, results) {
//                            if (err) {
//                                connection.release();
//                                callback(err);
//                            } else {
//                                tLeaf = results[0].tLeaf;
//                                console.log("오늘 획득 한 총 나뭇잎 개수 : " + tLeaf);
//                                callback(null, tLeaf);
//                            }
//                        });
//
//
//                    }
//                }
//
//                function insertLeaf(callback) {
//                    if (err) {
//                        connection.release();
//                        callback(err);
//                    } else {
//                        if (tLeaf >= 15) {
//                            connection.release();
//                            var err = {"message": "오늘의 나뭇잎 충전량을 초과하였습니다."};
//                            next(err);
//                            //callback(null, result);
//                        } else {
//                            var sql = "insert into leafhistory (applydate, leaftype, changedamount, iparty_id) " +
//                                "values (now(), 1, 5, ?)";
//                            connection.query(sql, [iparty_id], function (err, result) {
//                                if (err) {
//                                    connection.rollback();
//                                    connection.release();
//                                    callback(err);
//                                } else {
//                                    var leafId = result.insertId;
//                                    console.log("생성된 leaf_ID : " + leafId);
//                                    callback(null);
//                                }
//
//
//                            });
//                        }
//                    }
//                }
//
//                function selectUserLeaf(callback) {
//                    if (err) {
//                        connection.release();
//                        callback(err);
//                    } else {
//                        var sql = "select sum(changedamount) as tLeaf " +
//                            "from leafhistory " +
//                            "where iparty_id = ?";
//                        connection.query(sql, [iparty_id], function (err, result) {
//                            if (err) {
//                                connection.release();
//                                callback(err);
//                            } else {
//                                userLeaf = result[0].tLeaf;
//                                console.log("사용자의 총 나뭇잎 개수 " + userLeaf);
//                                callback(null);
//                            }
//                        })
//                    }
//
//                }
//
//                function updateUserLeaf(callback) {
//                    if (err) {
//                        connection.release();
//                        callback(err);
//                    } else {
//                        var sql = "update iparty " +
//                            "set totalleaf = ? " +
//                            "where id = ?";
//                        connection.query(sql, [userLeaf, iparty_id], function (err, result) {
//                            if (err) {
//                                connection.rollback();
//                                connection.release();
//                                callback(err);
//                            } else {
//                                connection.commit();
//                                connection.release();
//                                console.log("업데이트가 완료되었습니다.");
//                                callback(null);
//                            }
//                        });
//                    }
//                }
//
//                async.series([selectTodayLeaf, insertLeaf, selectUserLeaf, updateUserLeaf], function (err, result) {
//                    if (err) {
//                        callback(err);
//                    } else {
//                        callback(null, result);
//                    }
//                });
//
//
//            }
//        });
//    }
//
//    async.waterfall([getConnection, writeMystory, saveLeaf], function (err, results) {
//        if (err) {
//            var err = {
//                "code": "err011",
//                "message": "MYSTORY를 작성할 수 없습니다."
//            }
//            next(err);
//        } else {
//            var results = {
//                "result": {
//                    "ediaryId": ediary_id,
//                    "message": "쓰기가 완료되었습니다."
//                }
//            };
//            res.json(results);
//        }
//    })
//
//
//});

module.exports = router;
