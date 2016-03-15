var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
   if(typeof require !== 'undefined') XLSX = require('xlsx');
   var workbook = XLSX.readFile('../routes/test.xlsx');

   var first_sheet_name = workbook.SheetNames[0];
   var worksheet = workbook.Sheets[first_sheet_name];

   var sheet = XLSX.utils.sheet_to_json(worksheet);
   console.log('시트', sheet);

   res.json(sheet);
});

module.exports = router;