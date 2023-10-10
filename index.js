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
    cardHolderName: String,
    expirationDate: String,
    postalCode: String,
    email: String,
    country: String,
});

// Configure PayPal
const paypal = require('paypal-rest-sdk');
paypal.configure({
    mode: 'sandbox', // Set to 'sandbox' for testing, 'live' for production
    client_id: 'AS62O573CXqM8Ww8EEutbpTMHAQ0pv-c6Uy0O5GVFKvkORvRzXmdllNxGUDn2lDYTS2fonmTyjQZtodR',
    client_secret: 'ENNJgDzAapTo6s-pbe1U5Tg4IvUNr6uOLUg9QLinmnzDxwRwAr7gp8_4x4DE4SSICnu2cJ3W8VPmPmvi',
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

myApp.post('/processPayment', (req, res) => {
    const { amount, cardHolderName, email, country, postalCode } = req.body;

    // Store the entered amount and cardHolderName in the session
    req.session.paymentAmount = amount;
    req.session.cardHolderName = cardHolderName;
    req.session.email = email;
    req.session.country = country;
    req.session.postalCode = postalCode;

    const createPaymentJson = {
        intent: 'sale',
        payer: {
            payment_method: 'paypal'
        },
        redirect_urls: {
            return_url: 'http://localhost:8080/payment-success', // Replace with your success URL
            cancel_url: 'http://localhost:8080/payment-cancel' // Replace with your cancel URL
        },
        transactions: [{
            amount: {
                total: amount,
                currency: 'USD' // Change to your preferred currency
            },
            description: 'Payment for your order.'
        }]
    };

    paypal.payment.create(createPaymentJson, (error, payment) => {
        if (error) {
            console.error(error);
            res.redirect('/payment-failure'); // Handle payment creation error
        } else {
            for (let i = 0; i < payment.links.length; i++) {
                if (payment.links[i].rel === 'approval_url') {
                    res.redirect(payment.links[i].href);
                }
            }
        }
    });
});

myApp.get('/payment-success', (req, res) => {
    const { paymentId, PayerID } = req.query;
    const amount = req.session.paymentAmount;
    const cardHolderName = req.session.cardHolderName;
    const email = req.session.email; // Retrieve the email from the session
    const country = req.session.country; // Retrieve the country from the session
    const postalCode = req.session.postalCode;

    const executePaymentJson = {
        payer_id: PayerID,
        transactions: [{
            amount: {
                currency: 'USD',
                total: amount
            }
        }]
    };

    paypal.payment.execute(paymentId, executePaymentJson, (error, payment) => {
        if (error) {
            console.error(error);
            res.redirect('/payment-failure'); // Handle payment execution error
        } else {
            // Payment was successful, handle accordingly
            console.log('Payment executed successfully', payment);

            // Save payment details to MongoDB
            const paymentData = new Payment({
                userId: req.session.userId,  // Assuming you have stored the user's ID in the session
                amount: amount,
                cardHolderName: cardHolderName,
                email: email, // Save email in the MongoDB document
                country: country, // Save country in the MongoDB document
                postalCode: postalCode,
            });

            paymentData.save()
                .then((savedPayment) => {
                    // Handle successful payment and database save here
                    console.log('Payment details saved to MongoDB:', savedPayment);
                    res.render('payment-success', { amount, cardHolderName, email, country, postalCode });
                })
                .catch((dbError) => {
                    console.error('Error saving payment details to MongoDB:', dbError);
                    res.redirect('/payment-failure'); // Handle database save error
                });
        }
    });
});

myApp.get('/payment-cancel', (req, res) => {
    res.redirect('/payment-failure'); // Handle payment cancellation
});

myApp.listen(8080, () => {
    console.log('Server is running on port 8080');
});
