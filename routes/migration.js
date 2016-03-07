var express = require('express');
var async = require('async');
var bcrypt = require('bcrypt');
var xlsx = require('xlsx');
var path = require('path');
var fs = require('fs');


var router = express.Router();



router.post('/excel', function(req, res, next){
    //todo 1 : INSERT에서 사용할 SQL문을 작성한다.
    //현재는 ... /uploads/test.xlsx를 읽는다.
    var workbook = xlsx.readFile(path.join(__dirname, '../uploads/excel', 'test.xlsx'));





    //먼저 로컬에서 s3랑 연동 안 되는 엑셀 시트를 먼저 작업하자.
    //암호화 잘 구분하고...
    //기본키 테이블을 먼저 넣고, 외래키 있는 테이블은 나중에 넣자

    //workbook.SheetNames 배열에 워크시트 이름이 들어간다.
    //이 워크시트 이름이 데이터베이스의 테이블명이 된다.
    var first_sheet_name = workbook.SheetNames[0];

    //워크시트 객체 얻기
    var worksheet = workbook.Sheets[first_sheet_name];

    var desired_cell = worksheet['A1'];

    var desired_value = desired_cell.v;


    var columnArr = []; //컬럼명이 있는 셀의 위치. 예 : A1~D1
    var columnNameArr = []; //컬럼명. 예 : id, title, name, ...
    var columnValue = []; // DB에 넣을 실제 데이터의 배열.
    //[(value1, value2, value3), (value4, value5, value6), ...]

    var sheet_name_list = workbook.SheetNames;
    sheet_name_list.forEach(function(y) { /* iterate through sheets */
        var worksheet = workbook.Sheets[y];
        for (z in worksheet) {
            /* all keys that do not begin with "!" correspond to cell addresses */
            if(z[0] === '!') continue;
            console.log(y + "!" + z + "=" + JSON.stringify(worksheet[z].v));
            //console.log(z.substring(1,2));
            if(parseInt(z.substring(1,2)) === 1 && parseInt(z.length) === 2){
                columnArr.push(z);
            }
        }

    });

    console.log(columnArr);

    //컬럼명이 있는 셀의 위치로부터 실제 컬럼명을 찾아서 배열에 넣는다.
    columnArr.forEach(function(element, index){
        columnNameArr.push(worksheet[element].v);
    });

    console.log(columnNameArr);

    //sql문에 삽입할 문자열 enc1, enc2 만들기

    var enc1 = "";
    var enc2 = "(";

    enc1 += first_sheet_name + "(";

    columnNameArr.forEach(function(element, index){
        if(index < columnNameArr.length - 1){
            enc1 += element + ", "
            enc2 += "?,"
        } else {
            enc1 += element + ")"
            enc2 += "?)"
        }
    });

    console.log("enc : " + enc1);

    //todo 2 : 행과 열로부터 INSERT할 데이터 추출하기
    sheet_name_list.forEach(function(y){
        var worksheet = workbook.Sheets[y];
        for (z in worksheet) {

        }
    });

    columnValue.push();

    //todo 3 : DB에 INSERT하기

    function getConnection(callback){
        pool.getConnection(function(err, connection){
            if(err){
                callback(err);
            } else {
                callback(null, connection);
            }
        })
    }

    function insertDB(connection, callback){
        //완성된 sql문
        var sql =
            "INSERT INTO "
            + connection.escape(enc1)
            + " VALUES "
            + connection.escape(enc2);



        connection.query(sql, [worksheet['A2'].w, worksheet['B2'].w, worksheet['C2'].w, worksheet['D2'].w], function(err, result){
            connection.release();
            if(err){
                callback(err);
            } else {
                callback(null, result.insertId);
            }
        })
    }

    async.waterfall([], function(err, result){

    });

    res.json({
        "workSheetName" : first_sheet_name,
        "worksheetObject" : worksheet,
        "desiredCell" : desired_cell,
        "desiredValue" : desired_value,
        //"workbook" : workbook,
        //"value" : value
        //"columnArr" : columnArr
    });


});



module.exports = router;