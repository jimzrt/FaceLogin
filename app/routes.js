// load up the user model
var User = require('../app/models/user');

module.exports = function(app, passport, formidable, path, fs, face) {

    var crypto = require('crypto');
    var mime = require('mime');
    var sharp = require('sharp');



    ///api routes


    //remove all local users and reset microsoft api

    //testing only
    app.get('/api/reset', function(req, res) {
        face.personGroup.delete('facelogin-testing').then(function(result, error) {
            return face.personGroup.create('facelogin-testing', 'Face Login');
        }).then(function(result) {


            return res.json(result);

        }, function(error) {
            return res.json(error);
        });


        User.remove({}, function(err) {
            console.log('collection removed');
        });

    });




    // normal routes ===============================================================

    // show the home page (will also have our login links)
    app.get('/', function(req, res) {
        if (req.isAuthenticated())
            res.redirect('/profile');
        else
            res.render('index.ejs', {
                pageTitle: 'Index',
                title: '',
                cols: '12',
                offset: '0'

            });
    });


    // PROFILE SECTION =========================
    app.get('/profile', isLoggedIn, function(req, res) {
        res.render('profile.ejs', {
            user: req.user,
            pageTitle: 'Profile',
            title: 'Profil',
            cols: 12,
            offset: 0
        });
    });
    // // PROFILE SECTION =========================
    // app.get('/profile/pictures', isLoggedIn, function(req, res) {
    //     face.person.get('facelogin-testing', req.user.personId).then(function(result) {
    //         res.json(result.persistedFaceIds);
    //     });

    // });
    // PROFILE SECTION =========================
    app.post('/profile/pictures/add', isLoggedIn, function(req, res) {

        generatePictureObject(req.body.webcamPicture).then(function(result) {


            req.file = result;


            req.check('file', 'Kein Bild').notEmptyFile(req.file);

            req.getValidationResult().then(function(result) {
                if (!result.isEmpty()) {
                    if (req.file !== undefined) {
                        fs.unlinkSync(req.file.path);
                    }

                    return Promise.reject({
                        msg: "Validierungsprobleme"
                    });
                } else {
                    req.body.pictureID = req.file.filename;

                    return face.person.addFace('facelogin-testing', req.user.personId, {
                        path: req.file.path
                    })

                }


            }).then(function(result) {
                console.log(result);


                return User.findByIdAndUpdate(
                    req.user._id, {
                        $push: {
                            "pictures": {
                                file: req.file.filename,
                                pictureId: result.persistedFaceId
                            }
                        }
                    }, {
                        safe: true,
                        upsert: true,
                        new: true
                    }
                );




            }, function(error) {
                console.log(error);

                return Promise.reject(error);

            }).then(function(result) {
                // console.log(result);
                fs.writeFileSync('public/profilePictures/' + req.file.filename, fs.readFileSync('uploads/' + req.file.filename));
                return res.json({
                    filename: req.file.filename,
                    pictureId: result.pictures[result.pictures.length - 1].pictureId
                });
            }, function(error) {
                //return Promise.reject(error);
                return res.json(error);



            }).finally(function() {
                if (req.file !== undefined) {
                    fs.unlink(req.file.path);
                }


            });




        }, function(error) {

            return res.json(error);



        })

    });


    // PROFILE SECTION =========================
    app.delete('/profile/pictures/delete/:id', isLoggedIn, function(req, res) {



        face.person.deleteFace('facelogin-testing', req.user.personId, req.params.id).then(function(result) {


            return User.findByIdAndUpdate(req.user._id, {
                "$pull": {
                    "pictures": {
                        "pictureId": req.params.id
                    }
                }
            }, {
                safe: true,
                multi: true
            });




            //return res.json(result); 

        }, function(error) {

            return Promise.reject(error);
            //return res.json(error); 


        }).then(function(result) {

            var photo = result.pictures.filter(function(picture) {
                return picture.pictureId === req.params.id;
            }).pop();

            if (fs.existsSync('public/profilePictures/' + photo.file)) {
                fs.unlink('public/profilePictures/' + photo.file);

            }
            return res.json({
                status: "success"
            });

        }, function(error) {
            return res.json(error);


        });


    });


    app.post('/profile/useGloabalLogin', isLoggedIn, function(req, res) {

        console.log(req.body.useGloabalLogin);
        if (req.body.useGloabalLogin === 'true' || req.body.useGloabalLogin === 'false') {
            User.findByIdAndUpdate(req.user._id, {
                "globalLoginAllowed": req.body.useGloabalLogin
            }).then(function(result) {
                return res.json(result);
            }, function(error) {
                return res.json(error);

            })
        }


    });

    app.post('/profile/saveText', isLoggedIn, function(req, res) {


        User.findByIdAndUpdate(
            req.user._id, {
                secretText: req.body.data
            }, {
                safe: true,
                upsert: true,
                new: true
            }
        ).then(function(result) {
            res.json(result);
        }, function(error) {
            res.json(error);
        })
    });




    // LOGOUT ==============================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });




    // =============================================================================
    // AUTHENTICATE (FIRST LOGIN) ==================================================
    // =============================================================================

    // locally --------------------------------
    // LOGIN ===============================
    // show the login form
    app.get('/login', function(req, res) {
        res.render('login_signup.ejs', {
            message: req.flash('loginMessage'),
            pageTitle: 'Login',
            title: '>log.in',
            target: '/login',
            useGlobal: true,
            useUsername: true,
            button: 'Anmelden',
            followTarget: 'true',
            cols: 8,
            offset: 2
        });
    });

    // process the login form
    app.post('/login', function(req, res, next) {


        generatePictureObject(req.body.webcamPicture).then(function(result) {
            req.file = result;

            if (req.body.useGlobalLogin === "True") {
                req.body.username = "__global";
            }

            req.check('username', 'Username is required').notEmpty();
            req.check('fileValidationError', req.body.fileValidationError).isEmpty();
            req.check('file', 'Kein Bild').notEmptyFile(req.file);

            var err = req.getValidationResult().then(function(result) {
                if (!result.isEmpty()) {
                    req.flash('loginMessage', result.array());
                    if (req.file !== undefined) {
                        fs.unlinkSync(req.file.path);
                    }

                    return res.redirect('/login');
                } else {
                    req.body.pictureID = req.file.filename;
                    next();
                }


            });




        }, function(error) {

            req.flash('loginMessage', error.array());

            return res.redirect('/login');


        })




    }, passport.authenticate('local-login', {
        successRedirect: '/profile', // redirect to the secure profile section
        failureRedirect: '/login', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // SIGNUP =================================
    // show the signup form



    app.get('/signup', function(req, res) {
        res.render('login_signup.ejs', {
            message: req.flash('signupMessage'),
            pageTitle: 'Signup',
            title: '>sign.up',
            target: '/signup',
            cols: '8',
            offset: '2',
            useGlobal: false,
            useUsername: true,
            button: 'Registrieren',
            followTarget: 'true',
        });
    });

    // process the signup form
    app.post('/signup', function(req, res, next) {



        generatePictureObject(req.body.webcamPicture).then(function(result) {


            req.file = result;
            req.check('username', 'Username is required').notEmpty();
            //req.check('pictureID', 'Password is empty!').notEmpty();
            req.check('fileValidationError', req.body.fileValidationError).isEmpty();
            req.check('file', 'Kein Bild').notEmptyFile(req.file);
            //console.log(req.file.filename);

            var err = req.getValidationResult().then(function(result) {
                if (!result.isEmpty()) {
                    req.flash('signupMessage', result.array());
                    if (req.file !== undefined) {
                        fs.unlinkSync(req.file.path);
                    }

                    return res.redirect('/signup');
                } else {
                    req.body.pictureID = req.file.filename;
                    next();
                }


            });
        }, function(error) {

            req.flash('signupMessage', error);

            return res.redirect('/signup');


        })




    }, passport.authenticate('local-signup', {

        failureRedirect: '/signup',
        failureFlash: true // allow flash messages
    }), function(req, res) {


        face.personGroup.trainingStart('facelogin-testing').then(function(result) {
            console.log(result);
        }, function(error) {
            console.log(error);
        });

        res.redirect('/profile?firstLogin=true');

    });




    function generatePictureObject(base64String) {

        picture = {};
        if (base64String.indexOf("data:image/jpeg") == 0) {
            var base64Data = base64String.replace(/^data:image\/jpeg;base64,/, "");
            picture.originalname = 'webcam.jpeg';
            picture.mimetype = 'image/jpeg';
            picture.filename = crypto.randomBytes(20).toString('hex') + '.jpeg';


        } else if (base64String.indexOf("data:image/png") == 0) {
            var base64Data = base64String.replace(/^data:image\/png;base64,/, "");
            picture.originalname = 'webcam.png';
            picture.mimetype = 'image/png';
            picture.filename = crypto.randomBytes(20).toString('hex') + '.jpeg';

        } else {
            return Promise.reject({
                msg: "No Valid Picture"
            });
        }


        picture.fieldname = 'pictureFile';

        picture.destination = 'uploads/',
            picture.path = 'uploads/' + picture.filename;

        buffer = new Buffer(base64Data, 'base64')




        return sharp(buffer)
            .resize(1024, 1024)
            .max()
            .toFile("uploads/" + picture.filename)
            .then(function(result) {
                return picture;
            });


    }


};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();

    res.redirect('/login');
}