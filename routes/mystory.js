var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
    res.json(
        {
            "result" : {
                    "page" : 1,
                    "listPerPage" : 10,
                    "iPartyId" : 3,
                    "list" : [{
                        "id" : 3,
                        "title" : "재활용 합시당",
                        "wtime" : "2015-09-01 09:32:12",
                        "hAmount" : 2,
                        "rAmount" : 4,
                        "content" : "오늘 재활용 센터를 다녀왔는데...",
                        "file" : "ec2-52-79-116-72.ap-northeast-2.compute.amazonaws.com/files/photo/image1.jpg",
                        "backgroundId" : null
                    }, {
                        "id" : 4,
                        "title" : "집에서도 환경보호",
                        "wtime" : "2015-09-01 09:32:12",
                        "hAmount" : 12,
                        "rAmount" : 24,
                        "content" : "우리집에.....",
                        "file" : null,
                        "backgroundId" : 3
                    }

                    ]
            }
        }
    );
});

router.post('/', function(req, res, next) {
    res.json({
            "result" : {
            "ediaryId" : 12,
            "message" : "쓰기가 완료되었습니다."
        }
    });
});

router.put('/', function(req, res, next) {
    res.json({
        "result" : {
            "message" : "수정이 완료되었습니다."
            }
        });
});

module.exports = router;
