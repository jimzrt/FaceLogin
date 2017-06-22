// load the things we need
var mongoose = require('mongoose');
var fs = require('fs');

// define the schema for our user model
var userSchema = mongoose.Schema({


        username     : String,
        personId    : String,
        globalLoginAllowed: { type: Boolean, default: false },
        pictures : [{file: String, pictureId: String}],
        secretText : {type: String, default: 'Geheimer Text'}


});




// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
