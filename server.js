// server.js

// set up ======================================================================
// get all the tools we need
var compression = require('compression');
var express  = require('express');
var engine  = require('ejs-mate');

var expressValidator = require('express-validator');

var app      = express();
var port     = process.env.PORT || 8080;
var mongoose = require('mongoose');
var passport = require('passport');
var flash    = require('connect-flash');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');
var path = require('path');
var face    = require('./app/face.js');
 var faceClient = face('445004e343ae40bcbe94b6c7058ae170');


var formidable = require('formidable');
var fs = require('fs');

var configDB = require('./config/database.js');

// configuration ===============================================================
mongoose.connect(configDB.url); // connect to our database

require('./config/passport')(passport,fs, faceClient); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true,limit: '50mb' }));
app.use(expressValidator({
  customValidators: {
    notEmptyFile: function(value, file) {
    	return (file !== undefined && file !== "")
    		
      
    }
  }
}));

// use ejs-locals for all ejs templates: 
app.engine('ejs', engine);
app.set('view engine', 'ejs'); // set up ejs for templating
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

// required for passport
app.use(session({
    secret: 'ilovescotchscotchyscotchscotch', // session secret
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport,formidable, path, fs, faceClient); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);
