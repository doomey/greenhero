/**
 * Created by skplanet on 2016-02-12.
 */
var async = require('async');
var bcrypt = require('bcrypt');
var GoogleConfig = require('./googleConfig');
var googleTokenStrategy = require('passport-google-token');

module.exports = function(passport) {
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        pool.getConnection(function(err, connection) {
            if(err) {
                done(err);
            } else {
                var sql = "select id, username, name, google_id, google_username, google_email, google_name, google_photo "+
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

    passport.use('google-token', new googleTokenStrategy({
        "clientID" : googleConfig.google.appID,
        "cliendSecret" : googleConfig.google.appSecret
    }, function(accessToken, refreshToken, profile, done) {

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if(err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            })
        }

        function selectOrCreateUser(connection) {
            var select = "select id, nickname, google_email, google_name, google_photo "+
                          "from greendb.iparty "+
                          "where google_id = ?";
            connection.query(select, [profile.id], function(err, results) {
                if(err) {
                    connection.release();
                    callback(err);
                } else {
                    if(results.length === 0) {
                        var insert = "insert into greendb.iparty(nickname, google_id, google_token, google_email, google_name, totalleaf) "+
                                      "values(?, ?, ?, ?, ?, ?)";
                        connection.query(insert, [profile.displayName, profile.id, accessToken, profile.emails[0], profile.displayName, profile.photos[0]], function(err, result) {
                            connection.release();
                            if(err) {
                                callback(err);
                            } else {
                                var user = {
                                    "id" : result.insertId,
                                    "email" : profile.emails[0],
                                    "name" : profile.displayName,
                                    "nickname" : profile.displayName
                                }

                                callback(null, user);
                            }
                        })
                    } else {
                        if(accessToken === google_token || profile.emails[0] === results[0].google_email) {
                            connection.release();
                            var user = {
                                "id" : results[0].id,
                                "email" : results[0].email,
                                "name" : results[0].name,
                                "nickname" : results[0].nickname
                            }
                            callback(null, user);
                        } else {
                            var update = "update greendb.iparty "+
                                          "set google_token = ?, "+
                                          "    google_email = ?, "+
                                          "    google_name = ? "+
                                          "where google_id = ?"
                            connection.query(update, [accessToken, profile.emails[0], profile.displayName], function(err, result) {
                                connection.release();
                                if(err) {
                                    callback(err);
                                } else {
                                    var user = {
                                        "id" : results[0].id,
                                        "email" : profile.emails[0],
                                        "name" : profile.displayName,
                                        "nickname" : results[0].nickname
                                    }
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
    }));
}