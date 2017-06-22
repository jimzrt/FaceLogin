// load all the things we need
var LocalStrategy = require('passport-local').Strategy;


// load up the user model
var User = require('../app/models/user');


module.exports = function(passport, fs, face) {


    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
            done(err, user);
        });
    });

    // =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
    passport.use('local-login', new LocalStrategy({
            // by default, local strategy uses username and password, we will override with username
            usernameField: 'username',
            passwordField: 'pictureID',
            passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
        },
        function(req, username, password, done) {
            if (username) {
                username = username.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching
            }


            // asynchronous
            process.nextTick(function() {

                if (req.body.useGlobalLogin === "True") {



                    face.detect({
                        path: req.file.path,
                        returnFaceId: true
                    }).then(function(result) {


                        if (result.length == 0) {
                            return done(null, false, req.flash('loginMessage', {
                                msg: "Kein Gesicht erkannt!"
                            }));
                        }

                        return face.identify([result[0].faceId], 'facelogin-testing');
                    }, function(error) {


                        return done(null, false, req.flash('loginMessage', {
                            msg: error.message
                        }));
                    }).then(function(result) {

                            if (result[0].candidates.length == 0) {
                                return done(null, false, req.flash('loginMessage', {
                                    msg: "Keinen Benutzer gefunden!"
                                }));
                            }



                            User.findOne({
                                'personId': result[0].candidates[0].personId
                            }, function(err, user) {
                                // if there are any errors, return the error
                                if (err) {

                                    return done(err);

                                }

                                // if no user is found, return the message
                                if (!user) {

                                    return done(null, false, req.flash('loginMessage', {
                                        msg: 'No user found.'
                                    }));

                                }


                                if (!user.globalLoginAllowed) {
                                    return done(null, false, req.flash('loginMessage', {
                                        msg: 'Der Benutzer hat das globale Login nicht aktiviert.'
                                    }));
                                }



                                return done(null, user);




                            });
                        },
                        function(error) {



                            return done(null, false, req.flash('loginMessage', {
                                msg: error.message
                            }));
                        }).finally(function() {
                        if (req.file !== undefined) {
                            fs.unlink(req.file.path);
                        }
                    })




                } else {


                    User.findOne({
                        'username': username
                    }, function(err, user) {
                        // if there are any errors, return the error
                        if (err) {

                            return done(err);

                        }

                        // if no user is found, return the message
                        if (!user) {

                            return done(null, false, req.flash('loginMessage', {
                                msg: 'No user found.'
                            }));

                        }


                        face.detect({
                            path: req.file.path,
                            returnFaceId: true
                        }).then(function(result) {


                            if (result.length == 0) {
                                return done(null, false, req.flash('loginMessage', {
                                    msg: "Kein Gesicht erkannt!"
                                }));
                            }


                            return face.person.verify('facelogin-testing', user.personId, result[0].faceId);
                        }, function(error) {



                            return done(null, false, req.flash('loginMessage', {
                                msg: error.message
                            }));
                        }).then(function(result) {

                            if (!result.isIdentical) {

                                return done(null, false, req.flash('loginMessage', {
                                    msg: 'Keine Übereinstimmung. ' + (result.confidence * 100).toFixed(2) + '% Ähnlichkeit.'
                                }));

                            }

                            // all is well, return user
                            else {

                                return done(null, user);

                            }



                        }, function(error) {


                            return done(null, false, req.flash('loginMessage', {
                                msg: error.message
                            }));
                        }).finally(function() {
                            if (req.file !== undefined) {
                                fs.unlink(req.file.path);
                            }

                        })




                    });



                }
            });

        }));

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    passport.use('local-signup', new LocalStrategy({
            // by default, local strategy uses username and password, we will override with username
            usernameField: 'username',
            passwordField: 'pictureID',
            passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
        },
        function(req, username, picture, done) {


            if (username)
                username = username.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching


            // asynchronous
            process.nextTick(function() {


                // if the user is not already logged in:
                if (!req.user) {
                    User.findOne({
                        'username': username
                    }, function(err, user) {
                        // if there are any errors, return the error
                        if (err) {

                            return done(err);
                        }


                        // check to see if theres already a user with that username
                        if (user) {

                            return done(null, false, req.flash('signupMessage', {
                                msg: 'That username is already taken.'
                            }));
                        } else {

                            // create the user
                            var newUser = new User();

                            newUser.username = username;
                            var pictureA = {};
                            newUser.pictures.push(pictureA);
                            newUser.pictures[0].file = picture;

                            face.person.create('facelogin-testing', username).then(function(result) {
                                newUser.personId = result.personId;
                                return face.person.addFace('facelogin-testing', result.personId, {
                                    path: req.file.path
                                });
                            }, function(error) {



                                return done(null, false, req.flash('signupMessage', {
                                    msg: error.message
                                }));
                            }).then(function(result) {

                                newUser.pictures[0].pictureId = result.persistedFaceId;


                                return newUser.save();


                            }, function(error) {

                                face.person.delete('facelogin-testing', newUser.personId).then(function(result) {
                                    console.log(result);
                                });

                                return done(null, false, req.flash('signupMessage', {
                                    msg: error.message
                                }));
                            }).then(function(result) {

                                fs.writeFileSync('public/profilePictures/' + picture, fs.readFileSync('uploads/' + picture));
                                return done(null, newUser);

                            }, function(error) {
                                face.person.delete('facelogin-testing', newUser.personId).then(function(result) {
                                    console.log(result);
                                });

                                return done(null, false, req.flash('signupMessage', {
                                    msg: error.message
                                }));


                            }).finally(function() {
                                if (req.file !== undefined) {
                                    fs.unlink(req.file.path);
                                }
                            });


                        }

                    });
                    // if the user is logged in but has no local account...
                } else {
                    if (req.file !== undefined) {
                        fs.unlink(req.file.path);
                    }
                    // user is logged in and already has a local account. Ignore signup. (You should log out before trying to create a new account, user!)
                    return done(null, req.user);
                }

            });

        }));



};