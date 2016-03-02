var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var s3Config = require('../config/s3Config');
var AWS = require('aws-sdk');
var async = require('async');
var fs = require('fs');

router.post('/', function(req, res, next) {
   var form = new formidable.IncomingForm();
   form.uploadDir = path.join(__dirname, '../uploads');
   form.keepExtensions = true;
   form.multiples = true;

   form.parse(req, function(err, fields, files) { //업로드된 파일정보는 files에 있다.

      //async.each사용
      //조건 : array, 파일이 1개만 올라올 경우, 파일 업로드가 완료되었을 경우.

      var results = [];
      if(files['photo'] instanceof Array) { //post에서 받을 때 photo
         async.each(files['photo'], function(file, cb) {
            //사진을 여러개 업로드 할 경우
            var s3 = new AWS.S3({
               "accessKeyId" : s3Config.key,
               "secretAccessKey" : s3Config.secret,
               "region" : s3Config.region,
               "params" : {
                  "Bucket" : s3Config.bucket,
                  "Key" : s3Config.imageDir + "/" + path.basename(file.path), //path.basename으로 file의 이름을 알 수 있다.
                  "ACL" : s3Config.imageACL,
                  "ContentType" : "image/jpeg"
               }
            });
            //파일을 파이프로 이용하여 s3에 바로 업로드. 메모리를 쓰지 않는 방향으로...
            var body = fs.createReadStream(file.path);
            s3.upload({ "Body" : body })//자동으로 파이프를 생성. body는 read stream
               .on('httpUploadProgress', function(event) {
                  console.log(event);
               })
               .send(function(err, data) {
                  if(err) {
                     console.log(err);
                     cb(err);
                  } else {
                     console.log(data);
                     //파일 업로드에 성공하면 파일을 지우고 DB에 data.Location 저장
                     fs.unlink(file.path, function() {
                        console.log(file.path+ " 파일이 삭제되었습니다...");
                        results.push({ "s3URL" : data.Location });
                     });
                     //DB에 insert
                     function getConnection(callback) {
                        pool.getConnection(function(err, connection) {
                           if(err) {
                              callback(err);
                           } else {
                              callback(null, connection);
                           }
                        })
                     }

                     function insertPhotos(connection, callback) {
                        var insert = "insert into greendb.photos(photourl, uploaddate, originalfilename, modifiedfilename, phototype, refer_type, refer_id) "+
                           "values(?, now(), ?, ?, ?, 1, 1)";
                        connection.query(insert, [data.Location, file.name, path.basename(file.path), (path.extname(file.name)).replace('.', ''), 1, 1], function(err, result) {
                           connection.release();
                           if(err) {
                              callback(err);
                           } else {
                              callback(null, true);
                           }
                        });
                     }
                     async.waterfall([getConnection, insertPhotos], function(err, result) {
                        if(err) {
                           next(err);
                        } else {
                           cb();
                        }
                     });
                  }
               });
         }, function(err) {
            if(err) {
               next(err);
            } else {
               res.json(results);
            }
         });
      } else if(!files['photo']) {
         //사진을 올리지 않은 경우
         res.json({"message" : "선택한 파일이 없습니다"});
      } else {
         //사진을 하나만 올렸을 경우
         var file = files['photo'];
         var s3 = new AWS.S3({
            "accessKeyId" : s3Config.key,
            "secretAccessKey" : s3Config.secret,
            "region" : s3Config.region,
            "params" : {
               "Bucket" : s3Config.bucket,
               "Key" : s3Config.imageDir + "/" + path.basename(file.path),
               "ACL" : s3Config.imageACL,
               "ContentType" : "image/jpeg"
            }
         });
         var body = fs.createReadStream(file.path);
         s3.upload({ "Body" : body })
            .on('httpUploadProgress', function(event) {
               console.log(event);
            })
            .send(function(err, data) {
               if(err) {
                  console.log(err);
                  cb(err);
               } else {
                  console.log(data);
                  //파일 업로드에 성공하면 파일을 지우고 DB에 data.Location 저장
                  fs.unlink(file.path, function() {
                     console.log(file.path+ " 파일이 삭제되었습니다...");
                  });

                  function getConnection(callback) {
                     pool.getConnection(function(err, connection) {
                        if(err) {
                           callback(err);
                        } else {
                           callback(null, connection);
                        }
                     })
                  }

                  function insertPhotos(connection, callback) {
                     var insert = "insert into greendb.photos(photourl, uploaddate, originalfilename, modifiedfilename, phototype, refer_type, refer_id) "+
                        "values(?, now(), ?, ?, ?, 1, 1)";
                     connection.query(insert, [data.Location, file.name, path.basename(file.path), (path.extname(file.name)).replace('.', ''), 1, 1], function(err, result) {
                        connection.release();
                        if(err) {
                           callback(err);
                        } else {
                           callback(null, true);
                        }
                     });
                  }
                  async.waterfall([getConnection, insertPhotos], function(err, result) {
                     if(err) {
                        next(err);
                     } else {
                        res.json({ "s3URL" : data.Location });
                     }
                  });
               }
            });
      }
   });
});

module.exports = router;
