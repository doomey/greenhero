var express = require('express');
var router = express.Router();
var path = require('path');
var async = require('async');
var sqlAes = require('./sqlAES');
var bcrypt = require('bcrypt');

sqlAes.setServerKey(serverKey);

router.get('/', function(req, res, next) {
  if(typeof require !== 'undefined') XLSX = require('xlsx');
  var workbook = XLSX.readFile(path.join(__dirname, '../uploads/excel', 'test3.xlsx'));
  var sheet_name = workbook.SheetNames[0];
  var worksheet = workbook.Sheets[sheet_name];
  var sheetName = XLSX.utils.sheet;

  var sheet = XLSX.utils.sheet_to_json(worksheet);


  //console.log('시트이름', sheet_name);
  //console.log('시트', sheet);
  console.log('한개', sheet[0].name);
  console.log(sheet.length);
  //
  //res.json(sheet);

  for(var i=0 ; i<sheet.length ; i++){
    console.log(sheet[i].name);
    console.log(sheet[i].phone);
  }

  function getConnection(callback){
    pool.getConnection(function(err, connection){
      if(err){
        callback(err);
      } else {
        callback(null, connection);
      }
    });
  }

  function generateSalt(connection, callback){
    bcrypt.genSalt(10, function(err, salt){
      if(err){
        callback(err);
      } else {
        callback(null, salt, connection);
      }
    })
  }

  //function selectGenHash(salt, connection, callback){
  //    //엑셀에 있는 평문 패스워드 컬럼을 읽어서 해쉬화하고 db에 넣는다.
  //
  //    var sql = "select hashpassword from iparty";
  //    connection.query(sql, [], function(err, results){
  //        if(err){
  //            callback(err);
  //        } else {
  //            //callback(null, results);
  //            var temp = [];
  //            results.forEachOf(function(val, i, cb){
  //                bcrypt.hash(val, salt, function(err, hashPassword){
  //                    if(err){
  //                        callback(err);
  //                    } else {
  //                        temp.push(hashPassword);
  //                    }
  //                })
  //            })
  //            callback(null, temp, connection);
  //        }
  //    })
  //}

  function insertDB(salt, connection, callback){
    var sql = "insert into iparty(username, hashpassword, nickname, partytype, name, phone) " +
        "values(?, ?, ?, ?, " +
        sqlAes.encrypt(2) +
        ")";

    async.each(sheet, function(item, cb){
      console.log("test : " + item);
      console.log("변형되어야 할 값 1: " + item.hashpassword);
      bcrypt.hash(item.hashpassword, salt, function(err, hashPassword){
        if(err){
          callback(err);
        } else {

          //console.log("변형되어야 할 값 : " + sheet[i].hashpassword);

          connection.query(sql, [item.username, hashPassword, item.nickname, item.partytype, item.name, item.phone], function(err, result) {
            if(err){
              callback(err);
            } else {
              var result = {
                "id" : result.insertId,
                "partytype" : item.partytype,
                "name" : item.name,
                "phone" : item.phone,
                "password" : hashPassword
              }
              console.log(result);
              cb(null, result);
            }
          });

        }
      })

    }, function(err, result){
      if(err){
        callback(err);
      } else {
        console.log(result);
        callback(null, result);
      }
    })
  }

  async.waterfall([getConnection, generateSalt, insertDB], function(err, result){
    if(err){
      next(err);
    } else {
      res.json(result);
    }
  })

  //function selectBoard (connection, callback) {
  //  for (var i = 0; i < sheet.length; i++) {
  //   console.log("콘솔 찍음:" + sheet[i].name);
  //   console.log("콘솔 찍음:" + sheet[i].phone);
  //   console.log("콘솔 찍음:" + sheet[i].phone);
  //   var sql = "insert into iparty(partytype, name, phone)" +
  //             "values(?, " +
  //             sqlAes.encrypt(2) +
  //             ")";
  //   connection.query(sql, [sheet[i].partytype, sheet[i].name, sheet[i].phone],  function(err, result) {
  //      if (err) {
  //        var err = new Error('Board 데이터 생성에 실패하였습니다.');
  //      } else {
  //        var result = {
  //          "id ": result.insertId,
  //          "name" : sheet[i].name
  //        }
  //        console.log(result);
  //      }
  //   })
  //  }
  //}

  //async.waterfall([getConnection,selectBoard], function (err, result) {
  //  if (err) {
  //    next(err);
  //  } else {
  //    next(null, result);
  //  }
  //});

  //if(sheet_name == 'board') {
  //
  //}
  //
  //
  //console.log('시트이름', sheet_name);
  //console.log('시트', sheet);
  //console.log(sheet.length);
  //
  //res.json(sheet);
});

module.exports = router;