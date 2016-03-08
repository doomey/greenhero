var express = require('express');
var router = express.Router();
var path = require('path');
var async = require('async');
var uuid = require('uuid');
var fs = require('fs');
var mime = require('mime');
var AWS = require('aws-sdk');
var s3Config = require('../config/s3Config');

router.get('/', function(req, res, next) {
  if (typeof require !== 'undefined') XLSX = require('xlsx');
  var workbook = XLSX.readFile(path.join(__dirname, '../uploads/excel', 'datatable.xlsx'));
  var sheet_name = workbook.SheetNames[1];
  var worksheet = workbook.Sheets[sheet_name];
  var sheetName = XLSX.utils.sheet;
  var sheet = XLSX.utils.sheet_to_json(worksheet);

  console.log(sheet_name);
  console.log(sheet);

  function getConnection(callback){
    pool.getConnection(function(err, connection){
      if(err){
        callback(err);
      } else {
        callback(null, connection);
      }
    });
  }

  function insertGreenItems (connection, callback) {
    var resultArr = [];
    async.eachSeries(sheet, function (item, callback) {
      var location = "";
      var mimeType = mime.lookup(item.picture);
      var filepath = path.join(__dirname, '../uploads/', item.picture)
      var modifiedfile = uuid.v4() + item.picture;
      console.log(filepath);
      var body = fs.createReadStream(filepath);
      var s3 = new AWS.S3({
        "accessKeyId": s3Config.key,
        "secretAccessKey": s3Config.secret,
        "region": s3Config.region,
        "params": {
          "Bucket": s3Config.bucket,
          "Key": s3Config.imageDir + "/" + modifiedfile,
          "ACL": s3Config.imageACL,
          "ContentType": mimeType //mime.lookup
        }
      });
      s3.upload({"Body": body}) //pipe역할
        .on('httpUploadProgress', function (event) {
          console.log(event);
        })
        .send(function (err, data) {
          if (err) {
            console.log(err);
            callback(err);
          } else {
            location = data.Location;
            fs.unlink(filepath, function () {
              console.log(filepath + " 파일이 삭제되었습니다...");
            });
            var sql = "insert into greenitems(name, description, price, picture, sdate, edate) " +
              "values (?, ?, ?, ?, ?, ?)";
            connection.query(sql, [item.name, item.description, item.price, location, item.sdate, item.edate], function (err, result) {
              connection.release();
              if (err) {
                console.log('왜? 애러남?');
                callback(err);
              } else {
                console.log('장난침?');
                resultArr.push(result.insertId);
                callback(null);
              }
            });
          }
        });
    }, function (err) {
          if (err) {
            console.log("fail!!!");
            callback(err);
          } else {
            console.log("success!!!");
            callback(null, resultArr);
          }
        });
    }


  async.waterfall([getConnection, insertGreenItems], function (err, result) {
    if (err) {
      next(err);
    } else {
      console.log(result);
      res.json(result);
    }
  });


});





  //var mimeType = mime.lookup(item.picture);
  //var s3 = new AWS.S3({
  //  "accessKeyId" : s3Config.key,
  //  "secretAccessKey" : s3Config.secret,
  //  "region" : s3Config.region,
  //  "params" : {
  //    "Bucket" : s3Config.bucket,
  //    "Key" : s3Config.imageDir + "/" + item.picture,
  //    "ACL" : s3Config.imageACL,
  //    "ContentType": mimeType //mime.lookup
  //  }
  //});

module.exports = router;