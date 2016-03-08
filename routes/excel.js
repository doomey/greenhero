var express = require('express');
var router = express.Router();
var path = require('path');
var async = require('async');

router.get('/', function(req, res, next) {
  if(typeof require !== 'undefined') XLSX = require('xlsx');
  var workbook = XLSX.readFile(path.join(__dirname, '../uploads/excel', 'datatable.xlsx'));
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

  function getConnection(callback){
    pool.getConnection(function(err, connection){
      if(err){
        callback(err);
      } else {
        callback(null, connection);
      }
    });
  }



  function selectBoard (connection, callback) {
    for (var i = 0; i < sheet.length; i++) {
     console.log("콘솔 찍음:" + sheet[i].name);
     var sql = "insert into board(name)" +
               "values(?)"
     connection.query(sql, [sheet[i].name],  function(err, result) {
        if (err) {
          var err = new Error('Board 데이터 생성에 실패하였습니다.');
        } else {
          var result = {
            "id ": result.insertId,
            "name" : sheet[i].name
          }
          console.log(result);
        }
     })
    }
  }

  async.waterfall([getConnection,selectBoard], function (err, result) {
    if (err) {
      next(err);
    } else {
      next(null, result);
    }
  });

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