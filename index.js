// import dependencies you will use
const express = require('express');
const path = require('path');
//const bodyParser = require('body-parser'); // not required for Express 4.16 onwards as bodyParser is now included with Express
// set up expess validator
const { check, validationResult } = require('express-validator'); //destructuring an object
const mongoose = require('mongoose');
const fileUpload = require('express-fileupload');
// Requiring the session package
const session = require('express-session');
mongoose.connect('mongodb://127.0.0.1:27017/NexaConnect');
// defining collection:
const Blog = mongoose.model('Blog', {
    Name: String,
    Email: String,
    Description: String,
    ImagePath: String,
});
// create a model for User
const User = mongoose.model('User', {
    username: String,
    password: String
})
// set up variables to use packages
var myApp = express();
// myApp.use(bodyParser.urlencoded({extended:false})); // old way before Express 4.16
myApp.use(express.urlencoded({ extended: false })); // new way after Express 4.16

// setting up the session
myApp.use(session({
    secret: 'randomsecretcode',
    resave: false,
    saveUninitialized: true
}))
// set path to public folders and view folders

myApp.set('views', path.join(__dirname, 'views'));
//use public folder for CSS etc.
myApp.use(express.static(__dirname + '/public'));
myApp.set('view engine', 'ejs');
// using fileUpload
myApp.use(fileUpload());

var nameRegex = /^[a-zA-Z0-9]{1,}\s[a-zA-Z0-9]{1,}$/;
const filePath = 'public/images/';
// set up different routes (pages) of the website
// Ignore favicon requests
myApp.get('/favicon.ico', (req, res) => res.status(204));

// render the home page
myApp.get('/', function (req, res) {
    res.render('home'); // will render views/home.ejs
});

// render the login page
myApp.get('/login', function (req, res) {
    res.render('login'); // will render views/login.ejs
});
// render the signup page
myApp.get('/signup', function (req, res) {
    res.render('signup'); // will render views/login.ejs
});
myApp.post('/signin', function (req, res) {
    var pageData = {
        username: req.body.userName,
        password: req.body.password
    };
    User.findOne(pageData).then((user) => {
        req.session.username = user.username;
        req.session.isLoggedIn = true;
        res.render('home');
    }).catch((err) => {
        console.log(err);
        res.render('login');
    })
})

myApp.post('/createaccount', [
    check('userName', 'please enter username').not().isEmpty(),
    check('password', 'please enter password').not().isEmpty(),]
    , function (req, res) {
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            var pageData = {
                username: req.body.userName,
                password: req.body.password
            };
            var userNew = new User(pageData);
            userNew.save();
            res.render('login');
        }

    })
myApp.post('/process', [
    check('Description', 'Please enter a description.').not().isEmpty(),
    check('Email', 'Please enter a valid email').isEmail(),
    check('Name', 'Please enter firstname and lastname').matches(nameRegex)
], function (req, res) {

    // check for errors
    const errors = validationResult(req);
    console.log(errors);
    if (!errors.isEmpty()) {

        res.render('home', { er: errors.array() });
    }
    else {
        //fetch all the form fields
        var Name = req.body.Name; // the key here is from the name attribute not the id attribute
        var Email = req.body.Email;
        var Description = req.body.Description;
        console.log(Name + "  " + Email + "  " + Description);
        // create an object with the fetched data to send to the view
        var Image = req.files.Image;
        var ImageName = Image.name;
        var ImageSavePath = filePath + ImageName;
        Image.mv(ImageSavePath, function (err) {
            if (err)
                console.log(err);
        })
        var pageData = {
            Name: Name,
            Email: Email,
            Description: Description,
            ImagePath: 'images/' + ImageName,

        }
        var blogNew = new Blog(pageData);
        blogNew.save();
        // send the data to the view and render it
        res.render('blog', pageData);
    }
});

// returns all blogs
myApp.get('/blogs', function (req, res) {
    Blog.find({}).then((blogs) => {
        res.render('blogview', { blogs: blogs });
    }).catch((err) => {
        console.log(err);
    })
})

// create a get request to retrieve blog by ID
myApp.get('/:blogid', function (req, res) {
    Blog.findOne({ _id: req.params.blogid }).then((blog) => {
        // send the data to the view and render it
        res.render('blogview', { blogs: [blog] });
    }).catch((err) => {
        console.log(err);
    })
})

// start the server and listen at a port
myApp.listen(8080);

//tell everything was ok
console.log('Everything executed fine.. website at port 8080....');


