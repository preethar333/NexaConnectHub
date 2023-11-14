const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const { check, validationResult } = require('express-validator');
const nameRegex = /^[a-zA-Z0-9]{1,}\s[a-zA-Z0-9]{1,}$/;
const md5 = require('blueimp-md5');


mongoose.connect('mongodb://127.0.0.1:27017/NexaConnect');

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

const paypal = require('paypal-rest-sdk');
paypal.configure({
    mode: 'sandbox',
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
        password: md5(req.body.password),
    };

    User.findOne(pageData)
        .then((user) => {
            req.session.userId = user._id; 
            res.redirect('/blogs');
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
            password: md5(req.body.password),
        };

        const userNew = new User(pageData);
        userNew.save();
        res.redirect('/login');
    } else {
        res.render('signup', { errors: errors.array() });
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

myApp.get('/blogview/:id', (req, res) => {
    const blogId = req.params.id;
    Blog.findById(blogId)
        .then((blog) => {
            res.render('blog', { blog });
        })
        .catch((err) => {
            console.error(err);
        });
});

myApp.get('/edit/:id', (req, res) => {
    const blogId = req.params.id;
    Blog.findById(blogId)
        .then((blog) => {
            res.render('edit', { blog });
        })
        .catch((err) => {
            console.error(err);
        });
});

myApp.post('/edit/:id', (req, res) => {
    const blogId = req.params.id;
    const { Name, Email, Description } = req.body;

    Blog.findByIdAndUpdate(blogId, { Name, Email, Description }, { new: true })
        .then((updatedBlog) => {
            res.redirect(`/blogview/${updatedBlog._id}`);
        })
        .catch((err) => {
            console.error(err);
        });
});

myApp.get('/delete/:id', (req, res) => {
    const blogId = req.params.id;
    Blog.findByIdAndRemove(blogId)
        .then(() => {
            res.redirect('/blogs');
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
            return_url: 'http://localhost:8080/payment-success',
            cancel_url: 'http://localhost:8080/payment-cancel'
        },
        transactions: [{
            amount: {
                total: amount,
                currency: 'USD'
            },
            description: 'Payment for your order.'
        }]
    };

    paypal.payment.create(createPaymentJson, (error, payment) => {
        if (error) {
            console.error(error);
            res.redirect('/payment-failure');
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
    const email = req.session.email;
    const country = req.session.country;
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
            res.redirect('/payment-failure');
        } else {
            const paymentData = new Payment({
                userId: req.session.userId,
                amount: amount,
                cardHolderName: cardHolderName,
                email: email,
                country: country,
                postalCode: postalCode,
            });

            paymentData.save()
                .then((savedPayment) => {
                    res.render('payment-success', { amount, cardHolderName, email, country, postalCode });
                })
                .catch((dbError) => {
                    console.error(dbError);
                    res.redirect('/payment-failure');
                });
        }
    });
});

myApp.get('/payment-cancel', (req, res) => {
    res.redirect('/payment-failure');
});

myApp.listen(8080, () => {
    console.log('Server is running on port 8080');
});
