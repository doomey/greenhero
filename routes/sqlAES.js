var sk;
var conn;

exports.set = function(connection, serverKey) {
   conn = connection;
   sk = serverKey;
}

//exports.encrypt = function(data, end) {
//   if(!end) {
//      var dec = "aes_encrypt(" + data + ", unhex(" + conn.escape(sk) + ")) as " + data + ", ";
//      return dec;
//   } else {
//      var dec = "aes_encrypt(" + data + ", unhex(" + conn.escape(sk) + ")) as " + data + " ";
//      return dec;
//   }
//}

//exports.encrypt = function() {
//   var enc = " values(";
//   for(var i = 0; i < arguments.length; i++) {
//      enc += "convert(aes_decrypt(" + arguments[i] + ", unhex(" + conn.escape(sk) + ")) using utf8)";
//   }
//   enc += ")";
//
//   return enc;
//}

exports.decrypt = function(data, end) {
   if(!end) {
      var enc = "convert(aes_decrypt(" + data + ", unhex(" + conn.escape(sk) + ")) using utf8) as " + data + ", ";
      return enc;
   } else {
      var enc = "convert(aes_decrypt(" + data + ", unhex(" + conn.escape(sk) + ")) using utf8) as " + data + " ";
      return enc;
   }
}

