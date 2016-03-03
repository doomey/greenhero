var sk;
var conn;

exports.set = function(connection, serverKey) {
   conn = connection;
   sk = serverKey;
}

exports.encrypt = function(number) {
   number = parseInt(number);
   var enc = "";
   for(var i = 1; i<number; i++) {
      enc += " convert(aes_decrypt(?, unhex(" + conn.escape(sk) + ")) using utf8), ";
   }

   enc += " convert(aes_decrypt(?, unhex(" + conn.escape(sk) + ")) using utf8)";
   return enc;
}

exports.decrypt = function(data, end) {
   if(!end) {
      var enc = "convert(aes_decrypt(" + data + ", unhex(" + conn.escape(sk) + ")) using utf8) as " + data + ", ";
      return enc;
   } else {
      var enc = "convert(aes_decrypt(" + data + ", unhex(" + conn.escape(sk) + ")) using utf8) as " + data + " ";
      return enc;
   }
}

