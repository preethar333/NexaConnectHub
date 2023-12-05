const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const { check, validationResult } = require('express-validator');
const nameRegex = /^[a-zA-Z0-9]{1,}\s[a-zA-Z0-9]{1,}$/;
const fs = require('fs');

mongoose.connect('mongodb://127.0.0.1:27017/NexaConnect');

const Blog = mongoose.model('Blog', {
    Name: String,
    Email: String,
    Description: String,
    ImagePath: String,
    approved: { type: Boolean, default: false },

});

const Education = mongoose.model('Education', {
    Name: String,
    Email: String,
    educationCategory:String,
    Description: String,
    ImagePath: String,
    approved: { type: Boolean, default: false },

});

const Crowdfunding = mongoose.model('Crowdfunding', {
    Name: String,
    Email: String,
    crowdfundingType:String,
    Description: String,
    ImagePath: String,
    approved: { type: Boolean, default: false },

});

const User = mongoose.model('User', {
    username: String,
    password: String,
    role:String,
});

const bcrypt = require('bcrypt');

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

const shuffleArray = (array) => {
    // Implementation of the Fisher-Yates shuffle algorithm
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

myApp.get('/add-post', (req, res) => {
    res.render('add-post'); // Make sure you have an 'add-post.ejs' file in your views folder
  });

  myApp.get('/about-us', (req, res) => {
    res.render('about-us'); // Make sure you have an 'add-post.ejs' file in your views folder
  });

// Homepage route
myApp.get('/', async (req, res) => {
    try {
        // Fetch approved blog posts
        const approvedBlogPosts = await Blog.find({ approved: true });

        // Fetch approved education posts
        const approvedEducationPosts = await Education.find({ approved: true });

        // Fetch approved crowdfunding posts
        const approvedCrowdfundingPosts = await Crowdfunding.find({ approved: true });

        // Combine posts from all sources
        const allApprovedPosts = [...approvedBlogPosts, ...approvedEducationPosts, ...approvedCrowdfundingPosts];

        // Shuffle the combined array of approved posts
        const shuffledPosts = shuffleArray(allApprovedPosts);

        // Display three posts per row
        const postsPerRow = 3;
        const groupedPosts = [];
        for (let i = 0; i < shuffledPosts.length; i += postsPerRow) {
            groupedPosts.push(shuffledPosts.slice(i, i + postsPerRow));
        }

        // Pass the user data if logged in and the grouped posts
        const user = req.session.userId ? { username: req.session.username } : null;

        // Render the home template with the grouped posts
        res.render('home', { groupedPosts, user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching approved posts.');
    }
});



myApp.get('/login', (req, res) => {
    res.render('login');
});

myApp.get('/signup', (req, res) => {
    res.render('signup');
});

myApp.post('/signin', async (req, res) => {
    const { userName, password } = req.body;

    try {
        const user = await User.findOne({ username: userName });
        
        console.log('User:', user);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('login', { error: 'Invalid credentials' });
        }

        req.session.userId = user._id;
        req.session.username = user.username; // Set the actual username in the session


        // Redirect based on user role
        if (user.role === 'user') {
            return res.redirect('/');
        } else {
            console.log('Redirecting to admin dashboard...');
            return res.redirect('/admin-dashboard');
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'An error occurred' });
    }
});


myApp.post('/createaccount', [
    // ... existing validation middleware ...
], async (req, res) => {
    console.log('Received data:', req.body);

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.render('signup', { errors: errors.array() });
    }

    const { userName, password, role } = req.body;

    try {
        // Hash the password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);

        const pageData = {
            username: userName,
            password: hashedPassword,
            role: role,
        };

        const userNew = new User(pageData);
        const savedUser = await userNew.save();

        console.log('User saved:', savedUser);

        // Redirect based on user role
        if (role === 'user') {
            res.redirect('/');
        } else {
            res.redirect('/admin-dashboard');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send('Error creating user.');
    }
});

// Logout Route
myApp.get('/logout', (req, res) => {
    // Destroy the session to log out the user
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        // Redirect to the home page after logout
        res.redirect('/');
    });
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

myApp.post('/crowdfunding-process', [
    check('Name', 'Please enter a name.').not().isEmpty(),
    check('Email', 'Please enter a valid email').isEmail(),
    check('crowdfundingType', 'Please select a crowdfunding type.').not().isEmpty(),
    check('Description', 'Please enter a description.').not().isEmpty(),
    // You can add additional validation as needed
], (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        res.render('crowdfundingview', { er: errors.array() });
    } else {
        const Name = req.body.Name;
        const Email = req.body.Email;
        const crowdfundingType = req.body.crowdfundingType;
        const Description = req.body.Description;

        // Handle image upload if needed
        const Image = req.files.Image;
        const ImageName = Image.name;
        const ImageSavePath = filePath + ImageName;
        Image.mv(ImageSavePath, (err) => {
            if (err) console.error(err);
        });

        const crowdfundingData = {
            Name: Name,
            Email: Email,
            crowdfundingType: crowdfundingType,
            Description: Description,
            ImagePath: 'images/' + ImageName,
        };

        const crowdfundingPost = new Crowdfunding(crowdfundingData);
        crowdfundingPost.save();

        const user = req.session.userId ? { username: req.session.username } : null;
        
        // Define crowdfundingPosts variable here
        const crowdfundingPosts = [crowdfundingData];

        console.log('Crowdfunding Posts:', crowdfundingPosts);

        res.render('crowdfundingview', { crowdfundingData, user });
    }
});

myApp.get('/crowdfunding', async (req, res) => {
    try {
        // Fetch the crowdfundingPosts data from your database
        const crowdfundingPosts = await Crowdfunding.find({});
        const user = req.session.userId ? { username: req.session.username } : null;

        console.log('Crowdfunding Posts:', crowdfundingPosts);
        console.log('User:', user);

        // Pass the crowdfundingPosts and user variables to the rendering context
        res.render('crowdfundingview', { crowdfundingPosts, user });
    } catch (err) {
        console.error(err);
        // Handle the error (e.g., render an error page)
        res.status(500).send('Error fetching crowdfunding posts.');
    }
});


  myApp.get('/add-crowdfunding', (req, res) => {
    const user = req.session.userId ? { username: req.session.username } : null;
    const Name = req.body.Name || '';  // Set default values if not present
    const Email = req.body.Email || '';
    const Description = req.body.Description || '';

res.render('add-crowdfunding', { Name, Email, Description, user});
});
 

myApp.post('/education-process', [
    check('Description', 'Please enter a description.').not().isEmpty(),
    check('Email', 'Please enter a valid email').isEmail(),
    check('Name', 'Please enter firstname and lastname').matches(nameRegex),
], (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        res.render('add-education', { er: errors.array() });
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

        const educationData = {
            Name: Name,
            Email: Email,
            educationCategory: req.body.educationCategory,
            Description: Description,
            ImagePath: 'images/' + ImageName,
        };

        const educationPost = new Education(educationData);
        educationPost.save();

        res.render('educationPost', educationData);
        res.redirect('/education');

    }
});

  myApp.get('/education', (req, res) => {
    // Fetch the educationPosts data from your database
    Education.find({})
      .then((educationPosts) => {
        res.render('educationview', { educationPosts: educationPosts,  user: req.session.userId ? { username: req.session.username } : null });
      })
      .catch((err) => {
        console.error(err);
        // Handle the error (e.g., render an error page)
      });
});


myApp.get('/add-education', (req, res) => {
    const user = req.session.userId ? { username: req.session.username } : null;
    const Name = req.body.Name || '';  // Use req.query instead of req.body
    const Email = req.body.Email || '';
    const Description = req.body.Description || '';

    // Define the errors variable or provide a default empty array
    const errors = [];

    res.render('add-education', { Name, Email, Description, user, er: errors });
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



// Admin Dashboard Route
// Admin Dashboard route
myApp.get('/admin-dashboard', async (req, res) => {
    try {
        // Fetch all blog posts that are not approved
        const blogPosts = await Blog.find({ approved: false });

        // Fetch all education posts that are not approved
        const educationPosts = await Education.find({ approved: false });

        // Fetch all crowdfunding posts that are not approved
        const crowdfundingPosts = await Crowdfunding.find({ approved: false });

        // Pass the user data even if it's an admin
        const user = req.session.userId ? { username: "example", role: "admin" } : null;

        res.render('admin-dashboard', { user, blogPosts, educationPosts, crowdfundingPosts });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching unapproved posts for admin dashboard.');
    }
});


// Approve Blog Post Route
myApp.post('/approve-blog/:id', async (req, res) => {
    try {
        const postId = req.params.id;

        // Update the blog post to mark it as approved
        const updatedBlog = await Blog.findByIdAndUpdate(postId, { approved: true }, { new: true });

        if (!updatedBlog) {
            return res.status(404).send('Blog post not found.');
        }

        // Redirect to the admin dashboard after approval
        res.redirect('/admin-dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error approving the blog post.');
    }
});



// Delete Blog Post Route
myApp.post('/delete-blog/:id', (req, res) => {
    const postId = req.params.id;

    Blog.findByIdAndRemove(postId)
        .then((blog) => {
            if (!blog) {
                return res.status(404).send('Blog post not found.');
            }
            // Remove the associated image file if needed
            const imagePath = path.join(__dirname, blog.ImagePath);
            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.error('Error deleting image:', err);
                }
            });
            res.redirect('/admin-dashboard');
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error deleting the blog post.');
        });
});

// Similar routes for Education and Crowdfunding posts
// Approve Education Post Route
myApp.post('/approve-education/:id', async (req, res) => {
    try {
        const postId = req.params.id;

        // Update the education post to mark it as approved
        const updatedEducation = await Education.findByIdAndUpdate(postId, { approved: true }, { new: true });

        if (!updatedEducation) {
            return res.status(404).send('Education post not found.');
        }

        // Redirect to the admin dashboard after approval
        res.redirect('/admin-dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error approving the education post.');
    }
});

// Delete Education Post Route
myApp.post('/delete-education/:id', (req, res) => {
    const postId = req.params.id;

    Education.findByIdAndRemove(postId)
        .then((educationPost) => {
            if (!educationPost) {
                return res.status(404).send('Education post not found.');
            }
            // Remove the associated image file if needed
            const imagePath = path.join(__dirname, educationPost.ImagePath);
            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.error('Error deleting image:', err);
                }
            });
            res.redirect('/admin-dashboard');
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error deleting the education post.');
        });
});

// Approve Crowdfunding Post Route
myApp.post('/approve-crowdfunding/:id', async (req, res) => {
    try {
        const postId = req.params.id;

        // Update the crowdfunding post to mark it as approved
        const updatedCrowdfunding = await Crowdfunding.findByIdAndUpdate(postId, { approved: true }, { new: true });

        if (!updatedCrowdfunding) {
            return res.status(404).send('Crowdfunding post not found.');
        }

        // Redirect to the admin dashboard after approval
        res.redirect('/admin-dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error approving the crowdfunding post.');
    }
});
// Delete Crowdfunding Post Route
myApp.post('/delete-crowdfunding/:id', (req, res) => {
    const postId = req.params.id;

    Crowdfunding.findByIdAndRemove(postId)
        .then((crowdfundingPost) => {
            if (!crowdfundingPost) {
                return res.status(404).send('Crowdfunding post not found.');
            }
            // Remove the associated image file if needed
            const imagePath = path.join(__dirname, crowdfundingPost.ImagePath);
            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.error('Error deleting image:', err);
                }
            });
            res.redirect('/admin-dashboard');
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error deleting the crowdfunding post.');
        });
});



myApp.listen(8080, () => {
    console.log('Server is running on port 8080');
});
