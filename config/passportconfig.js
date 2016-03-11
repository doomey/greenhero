var async = require('async');
var bcrypt = require('bcrypt');
var GoogleConfig = require('./googleConfig');
var GoogleTokenStrategy = require('passport-google-id-token');
var sqlAes = require('../routes/sqlAES.js');

sqlAes.setServerKey(serverKey);

module.exports = function(passport) {
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        pool.getConnection(function(err, connection) {
            if(err) {
                done(err);
            } else {
                var sql = "select " +
                          "id, username, google_id, google_name, nickname, " +
                          //"convert(aes_decrypt(name, unhex(" + connection.escape(serverKey) + ")) using utf8) as na, " +
                          //"convert(aes_decrypt(google_email, unhex(" + connection.escape(serverKey) + ")) using utf8) as gemail " +
                          sqlAes.decrypt("name") +
                          sqlAes.decrypt("google_email", true) +
                          "from iparty " +
                          "where id = ?";
                connection.query(sql, [id], function(err, results) {
                    connection.release();
                    if(err) {
                        done(err);
                    } else {
                        var user = {
                            "id" : results[0].id,
                            "username" : results[0].username,
                            "name" : results[0].name,
                            "nickname" : results[0].nickname
                        };
                        done(null, user);
                    }
                });
            }
        });
    });

    passport.use(new GoogleTokenStrategy({
        "clientID" : GoogleConfig.google.appId,
        "passReqToCallback" : true
    }, function(req, parseToken, googleId, done) {

       function getConnection(callback) {
          pool.getConnection(function(err, connection) {
             if(err) {
                callback(err);
             } else {
                callback(null, connection);
             }
          })
       }

       function selectOrCreateUser(connection, callback) {
          var select = "select id, nickname, google_email, google_name "+
             "from iparty "+
             "where google_id = ?";
          connection.query(select, [googleId], function(err, results) {
             if(err) {
                connection.release();
                callback(err);
             } else {
                if(results.length === 0) {
                   var insert = "insert into iparty(nickname, google_id, google_token, google_email, google_name, totalleaf, registration_token) "+
                      "values(?, ?, ?, ?, ?, 0, ?)";
                   connection.query(insert, [!parseToken.payload.nickname? parseToken.payload.name : parseToken.payload.nickname, googleId, req.body.id_token, parseToken.payload.email, parseToken.payload.name, req.body.registration_id], function(err, result) {
                      connection.release();
                      if(err) {
                         callback(err);
                      } else {
                         var user = {
                            "id" : result.insertId,
                            "email" : parseToken.payload.email,
                            "name" : parseToken.payload.name,
                            "nickname" : parseToken.payload.nickname
                         }

                         callback(null, user);
                      }
                   })
                } else {
                   if(req.body.registration_id === results[0].google_token) {
                      connection.release();
                      var user = {
                         "id" : results[0].id,
                         "email" : results[0].nickname,
                         "name" : results[0].nickname,
                         "nickname" : results[0].nickname
                      };
                      callback(null, user);
                   } else {
                      var update = "update iparty "+
                         "set google_token = ? "+
                         "where google_id = ?"
                      connection.query(update, [req.body.id_token, parseToken.payload.email], function(err, result) {
                         connection.release();
                         if(err) {
                            callback(err);
                         } else {
                            var user = {
                               "id" : results[0].id,
                               "email" : parseToken.payload.email,
                               "name" : parseToken.payload.name,
                               "nickname" : results[0].nickname
                            };
                            callback(null, user);
                         }
                      });
                   }
                }
             }
          });
       }

       async.waterfall([getConnection, selectOrCreateUser], function(err, user) {
          if(err) {
             done(err);
          } else {
             done(null, user);
          }
       });
    })
    );

}