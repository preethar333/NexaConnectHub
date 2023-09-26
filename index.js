// import dependencies you will use
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const { check, validationResult } = require('express-validator');
const nameRegex = /^[a-zA-Z0-9]{1,}\s[a-zA-Z0-9]{1,}$/;

mongoose.connect('mongodb://127.0.0.1:27017/NexaConnect');

// Define MongoDB models
const Blog = mongoose.model('Blog', {
    Name: String,
    Email: String,
    Description: String,
    ImagePath: String,
});

const User = mongoose.model('User', {
    username: String,
    password: String,
});

const Payment = mongoose.model('Payment', {
    userId: String,
    amount: Number,
    cardNumber: String,
    cardHolderName: String,
    expirationDate: String,
    postalCode: String,
    // Add other fields as needed
});

const myApp = express();

myApp.use(express.urlencoded({ extended: false }));
myApp.use(session({
    secret: 'randomsecretcode',
    resave: false,
    saveUninitialized: true,
}));

myApp.set('views', path.join(__dirname, 'views'));
myApp.use(express.static(__dirname + '/public'));
myApp.set('view engine', 'ejs');
myApp.use(fileUpload());
const filePath = 'public/images/';

myApp.get('/favicon.ico', (req, res) => res.status(204));

myApp.get('/', (req, res) => {
    res.render('home');
});

myApp.get('/login', (req, res) => {
    res.render('login');
});

myApp.get('/signup', (req, res) => {
    res.render('signup');
});

myApp.post('/signin', (req, res) => {
    const pageData = {
        username: req.body.userName,
        password: req.body.password,
    };

    User.findOne(pageData)
        .then((user) => {
            req.session.userId = user._id; // Store the user's ID in the session
            res.render('home');
        })
        .catch((err) => {
            console.error(err);
            res.render('login');
        });
});

myApp.post('/createaccount', [
    check('userName', 'please enter username').not().isEmpty(),
    check('password', 'please enter password').not().isEmpty(),
], (req, res) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
        const pageData = {
            username: req.body.userName,
            password: req.body.password,
        };

        const userNew = new User(pageData);
        userNew.save();
        res.render('login');
    }
});

myApp.post('/process', [
    check('Description', 'Please enter a description.').not().isEmpty(),
    check('Email', 'Please enter a valid email').isEmail(),
    check('Name', 'Please enter firstname and lastname').matches(nameRegex),
], (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        res.render('home', { er: errors.array() });
    } else {
        const Name = req.body.Name;
        const Email = req.body.Email;
        const Description = req.body.Description;

        const Image = req.files.Image;
        const ImageName = Image.name;
        const ImageSavePath = filePath + ImageName;
        Image.mv(ImageSavePath, (err) => {
            if (err) console.error(err);
        });

        const pageData = {
            Name: Name,
            Email: Email,
            Description: Description,
            ImagePath: 'images/' + ImageName,
        };

        const blogNew = new Blog(pageData);
        blogNew.save();
        res.render('blog', pageData);
    }
});

myApp.get('/blogs', (req, res) => {
    Blog.find({})
        .then((blogs) => {
            res.render('blogview', { blogs: blogs });
        })
        .catch((err) => {
            console.error(err);
        });
});

myApp.get('/payment', (req, res) => {
    res.render('payment');
});

myApp.post('/processPayment', async (req, res) => {
    const { amount, cardNumber, cardHolderName, expirationDate, postalCode } = req.body;
    const userId = req.session.userId; // Retrieve user ID from the session

    const paymentData = {
        userId: userId,
        amount: parseFloat(amount),
        cardNumber: cardNumber,
        cardHolderName: cardHolderName,
        expirationDate: expirationDate,
        postalCode: postalCode,
    };

    try {
        const payment = new Payment(paymentData);
        await payment.save();
        res.render('receipt', { payment: payment });
    } catch (error) {
        console.error(error);
        res.redirect('/payment-failure');
    }
});

myApp.get('/payment-success', async (req, res) => {
    const paymentId = req.query.paymentId; // Assuming you pass the payment ID as a query parameter

    try {
        const payment = await Payment.findById(paymentId).exec();
        if (!payment) {
            console.error('Payment not found'); // Handle not found case
            res.redirect('/payment-failure');
        } else {
            res.render('payment-success', { payment: payment });
        }
    } catch (error) {
        console.error(error);
        res.redirect('/payment-failure'); // Handle errors appropriately
    }
});



myApp.listen(8080, () => {
    console.log('Server is running on port 8080');
});
