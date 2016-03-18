var async = require('async');
var bcrypt = require('bcrypt');
var LocalStrategy = require('passport-local').Strategy;
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
                          "id, nickname, " +
                          sqlAes.decrypt("google_name", true) +
                          "from iparty " +
                          "where id = ?";
                connection.query(sql, [id], function(err, results) {
                    connection.release();
                    if(err) {
                        done(err);
                    } else {
                        var user = {
                            "id" : results[0].id,
                            "name" : results[0].google_name,
                            "nickname" : results[0].nickname
                        };
                        done(null, user);
                    }
                });
            }
        });
    });

    passport.use('google-id-token', new GoogleTokenStrategy({
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
          var select = "select id, nickname, google_email, " +
                       sqlAes.decrypt("google_name", true) +
                       "from iparty "+
                       "where google_id = ?";
          connection.query(select, [googleId], function(err, results) {
             if(err) {
                connection.release();
                callback(err);
             } else {
                if(results.length === 0) {
                   var insert = "insert into iparty(nickname, google_id, google_token, google_email, totalleaf, registration_token, partytype, google_name) "+
                                "values(?, ?, ?, ?, 0, ?, 1, " +
                                "aes_encrypt(?, unhex(" + connection.escape(serverKey) + ")) " +
                                ")";
                   connection.query(insert, [!parseToken.payload.nickname? parseToken.payload.name : parseToken.payload.nickname, googleId, req.body.id_token, parseToken.payload.email, 0, req.body.registration_id, parseToken.payload.name], function(err, result) {
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
                   if(req.body.registration_id === results[0].registration_token && req.body.id_token === results[0].google_token) {
                      connection.release();
                      var user = {
                         "id" : results[0].id,
                         "email" : results[0].google_email,
                         "name" : results[0].google_name,
                         "nickname" : results[0].nickname
                      };
                      callback(null, user);
                   } else {
                      var update = "update iparty "+
                         "set registration_token = ?, "+
                         "    google_token = ?"+
                         "where google_id = ?"
                      connection.query(update, [req.body.registration_id, req.body.id_token, googleId], function(err, result) {
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

  passport.use('local-login', new LocalStrategy({
    usernameField: "username",
    passwordField: "password",
    passReqToCallback: true
  }, function(req, username, password, done) {

    //1. getConnection
    function getConnection(callback) {
      pool.getConnection(function(err, connection) {
        if(err) {
          callback(err);
        } else {
          callback(null, connection);
        }
      });
    }
    //2. selectpassword
    function selectIparty(connection, callback) {
      var select = "select id, username, hashpassword, nickname, google_email, " +
        sqlAes.decrypt("google_name", true) +
          //"convert(aes_decrypt(google_email, unhex(" + connection.escape(serverKey) + ")) using utf8) as gemail " +
        "from iparty " +
        "where username = ?";
      connection.query(select, [username], function(err, results) {
        connection.release();
        if(err) {
          callback(err);
        } else {
          if(results.length === 0) {
            var err = new Error('사용자가 존재하지 않습니다...');
            callback(err);
          } else {
            var user = {
              "id" : results[0].id,
              "hashPassword" : results[0].hashpassword,
              "email" : results[0].google_email,
              "name" : results[0].google_name,
              "nickname" : results[0].nickname
            };
            console.log('유저', user);
            callback(null, user);
          }
        }
      });
    }

    //3. compare
    function compare(user, callback) {
      bcrypt.compare(password, user.hashPassword, function(err, result) {
        if(err) {
          console.log('여기 됨');
          callback(err);
        } else {
          if(result === true) {

            callback(null, user);
          } else {
            callback(null, false);
          }
        }
      })
    }

    async.waterfall([getConnection, selectIparty, compare], function(err, user) {
      if(err) {
        done(err);
      } else {
        delete user.hashPassword;
        done(null, user);
      }
    });
  }));



}