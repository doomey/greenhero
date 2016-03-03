var async = require('async');
var bcrypt = require('bcrypt');
var GoogleConfig = require('./googleConfig');
var GoogleTokenStrategy = require('passport-google-token').Strategy;
var LocalStrategy = require('passport-local').Strategy;

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
                          "id, username, google_id, google_name, " +
                          "convert(aes_decrypt(name, unhex(" + connection.escape(serverKey) + ")) using utf8) as na, " +
                          "convert(aes_decrypt(google_email, unhex(" + connection.escape(serverKey) + ")) using utf8) as gemail " +
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
                            "name" : results[0].na,
                            "nickname" : results[0].nickname
                        };
                        done(null, user);
                    }
                });
            }
        });
    });

    //passport.use('google-token', new GoogleTokenStrategy({
    //    "clientID" : GoogleConfig.google.appId,
    //    "cliendSecret" : GoogleConfig.google.appSecret
    //}, function(accessToken, refreshToken, profile, done) {
    //    console.log('google-token들어옴');
    //    function getConnection(callback) {
    //        pool.getConnection(function(err, connection) {
    //            if(err) {
    //                callback(err);
    //            } else {
    //                callback(null, connection);
    //            }
    //        })
    //    }
    //
    //    function selectOrCreateUser(connection) {
    //        var select = "select id, nickname, google_email, google_name, google_photo "+
    //                      "from greendb.iparty "+
    //                      "where google_id = ?";
    //        connection.query(select, [profile.id], function(err, results) {
    //            if(err) {
    //                connection.release();
    //                callback(err);
    //            } else {
    //                if(results.length === 0) {
    //                    var insert = "insert into greendb.iparty(nickname, google_id, google_token, google_email, google_name, totalleaf) "+
    //                                  "values(?, ?, ?, ?, ?, ?)";
    //                    connection.query(insert, [profile.displayName, profile.id, accessToken, profile.emails[0], profile.displayName, profile.photos[0]], function(err, result) {
    //                        connection.release();
    //                        if(err) {
    //                            callback(err);
    //                        } else {
    //                            var user = {
    //                                "id" : result.insertId,
    //                                "email" : profile.emails[0],
    //                                "name" : profile.displayName,
    //                                "nickname" : profile.displayName
    //                            }
    //
    //                            callback(null, user);
    //                        }
    //                    })
    //                } else {
    //                    if(accessToken === google_token || profile.emails[0] === results[0].google_email) {
    //                        connection.release();
    //                        var user = {
    //                            "id" : results[0].id,
    //                            "email" : results[0].email,
    //                            "name" : results[0].name,
    //                            "nickname" : results[0].nickname
    //                        };
    //                        callback(null, user);
    //                    } else {
    //                        var update = "update greendb.iparty "+
    //                                      "set google_token = ?, "+
    //                                      "    google_email = ?, "+
    //                                      "    google_name = ? "+
    //                                      "where google_id = ?"
    //                        connection.query(update, [accessToken, profile.emails[0], profile.displayName], function(err, result) {
    //                            connection.release();
    //                            if(err) {
    //                                callback(err);
    //                            } else {
    //                                var user = {
    //                                    "id" : results[0].id,
    //                                    "email" : profile.emails[0],
    //                                    "name" : profile.displayName,
    //                                    "nickname" : results[0].nickname
    //                                };
    //                                callback(null, user);
    //                            }
    //                        });
    //                    }
    //                }
    //            }
    //        });
    //    }
    //
    //    async.waterfall([getConnection, selectOrCreateUser], function(err, user) {
    //        if(err) {
    //            done(err);
    //        } else {
    //            done(null, user);
    //        }
    //    });
    //}));

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
            var select = "select id, username, hashpassword, nickname, google_name, " +
                         "convert(aes_decrypt(google_email, unhex(" + connection.escape(serverKey) + ")) using utf8) as gemail " +
                         "from greendb.iparty " +
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
                            "email" : results[0].gemail,
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