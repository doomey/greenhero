var express = require('express');
var router = express.Router();


/* GET home page. */
router.get('/', function(req, res, next) {
    res.json({
      "result": {
        "page": 1,
        "listPerPage": 10,
        "list": [{
          "id": 1,
          "title": "오늘의 분리수거",
          "nickname": "해봄배범",
          "wtime": "2016-01-25 08:33:12",
          "eDiaryHeart": 2,
          "rAmount": 4,
          "backgroundId": null,
          "content": "오늘은 분리수거를 하는 날이라...",
          "fileUrl": "/photos/xxx.png"
        }],

        "newest": [
          {"id": 43, "title": "나무를 심어요", "thumbnail": "/photos/xxx.jpg"},
          {"id": 42, "title": "쓰레기를 버리지 맙시다", "thumbnail": "/photos/xxx.jpg"}
        ]
      }
    });
});

router.get('/:ediaryId/replies', function(req, res, next) {
    res.json({
      "result" : {
        "ediaryId" : 1,
        "page" : 1,
        "listPerPage" : 10,
        "list" : [{
          "nickname" : "이동훈훈",
          "replyDate" : "2016-02-25 08:33:12",
          "replyBody" : "저도 분리수거 참 좋아하는데요..."
        }]
      }
    });
});


router.post('/:ediaryId/replies', function(req, res, next) {
  res.json({
    "result": {
      "replyId": 2,
      "message": "댓글이 작성되었습니다."
    }
  });
});

router.put('/:ediaryId/replies/:replyId', function(req, res, next) {
     res.json({
       "result": {
         "message": "수정이 완료되었습니다."
       }
     })
});


module.exports = router;

