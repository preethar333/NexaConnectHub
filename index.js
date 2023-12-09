const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const { check, validationResult } = require('express-validator');
const nameRegex = /^[a-zA-Z0-9]{1,}\s[a-zA-Z0-9]{1,}$/;
const fs = require('fs');


mongoose.connect('mongodb://127.0.0.1:27017/NexaConnect');

const ApprovedPost = mongoose.model('ApprovedPost', {
    Name: String,
    Email: String,
    Description: String,
    ImagePath: String,
    postType: { type: String },
});

const Education = mongoose.model('Education', {
    Name: String,
    Email: String,
    educationCategory:String,
    Description: String,
    ImagePath: String,
    approved: { type: Boolean, default: false },
    postType: { type: String, default: 'education' },

});

const Crowdfunding = mongoose.model('Crowdfunding', {
    Name: String,
    Email: String,
    crowdfundingType:String,
    Description: String,
    ImagePath: String,
    approved: { type: Boolean, default: false },
    postType: { type: String, default: 'crowdfunding' },

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

const newsSchema = new mongoose.Schema({
    headline: String,
    link: String,
    image: String,
  });
  
  const News = mongoose.model('News', newsSchema);

const paypal = require('paypal-rest-sdk');
paypal.configure({
    mode: 'sandbox',
    client_id: 'AS62O573CXqM8Ww8EEutbpTMHAQ0pv-c6Uy0O5GVFKvkORvRzXmdllNxGUDn2lDYTS2fonmTyjQZtodR',
    client_secret: 'ENNJgDzAapTo6s-pbe1U5Tg4IvUNr6uOLUg9QLinmnzDxwRwAr7gp8_4x4DE4SSICnu2cJ3W8VPmPmvi',
});

const myApp = express();
myApp.use(express.static(__dirname + '/public'));

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

  myApp.get('/about-us', (req, res) => {
    res.render('about-us', { user: req.user }); // Make sure you have an 'add-post.ejs' file in your views folder
  });

// Homepage route
myApp.get('/', async (req, res) => {
    try {
        // Fetch approved education posts
        const approvedEducationPosts = await Education.find({ approved: true });

        // Fetch approved crowdfunding posts
        const approvedCrowdfundingPosts = await Crowdfunding.find({ approved: true });

        // Combine posts from all sources
        const allApprovedPosts = [ ...approvedEducationPosts, ...approvedCrowdfundingPosts];

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


myApp.post('/crowdfunding-process', [
    check('Name', 'Please enter a name.').not().isEmpty(),
    check('Email', 'Please enter a valid email').isEmail(),
    check('crowdfundingType', 'Please select a crowdfunding type.').not().isEmpty(),
    check('Description', 'Please enter a description.').not().isEmpty(),
], async (req, res) => {
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
            postType: 'crowdfunding',  // Add postType
        };

        const crowdfundingPost = new Crowdfunding(crowdfundingData);
        await crowdfundingPost.save();

        try {
            // Fetch all crowdfunding posts from the database
            const crowdfundingPosts = await Crowdfunding.find({ postType: 'crowdfunding' });  // Filter by postType
            const user = req.session.userId ? { username: req.session.username } : null;

            console.log('Crowdfunding Posts:', crowdfundingPosts);

            res.render('crowdfundingview', { crowdfundingPosts, user });
        } catch (err) {
            console.error(err);
            // Handle the error (e.g., render an error page)
            res.status(500).send('Error fetching crowdfunding posts.');
        }
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
    check('Name', 'Please enter a name.').not().isEmpty(),
    check('Email', 'Please enter a valid email').isEmail(),
    check('educationCategory', 'Please select a Category.').not().isEmpty(),
    check('Description', 'Please enter a description.').not().isEmpty(),
], async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        res.render('educationview', { er: errors.array() });
    } else {
        const Name = req.body.Name;
        const Email = req.body.Email;
        const educationCategory = req.body.educationCategory; // Fix: Correct variable name
        const Description = req.body.Description;

        // Handle image upload if needed
        const Image = req.files.Image;
        const ImageName = Image.name;
        const ImageSavePath = filePath + ImageName;
        Image.mv(ImageSavePath, (err) => {
            if (err) console.error(err);
        });

        const educationData = {
            Name: Name,
            Email: Email,
            educationCategory: educationCategory, // Fix: Correct variable name
            Description: Description,
            ImagePath: 'images/' + ImageName,
        };

        const educationPost = new Education(educationData); // Fix: Correct variable name
        await educationPost.save();

        try {
            // Fetch all crowdfunding posts from the database
            const educationPosts = await Education.find({});
            const user = req.session.userId ? { username: req.session.username } : null;

            res.render('educationview', { educationPosts, user });
        } catch (err) {
            console.error(err);
            // Handle the error (e.g., render an error page)
            res.status(500).send('Error fetching education posts.');
        }
    }
});


myApp.get('/education', async (req, res) => {
    try {
        // Fetch the educationPosts data from your database
        const educationPosts = await Education.find({});
        const user = req.session.userId ? { username: req.session.username } : null;

        console.log('User:', user);

        // Pass the educationPosts and user variables to the rendering context
        res.render('educationview', { educationPosts, user });
    } catch (err) {
        console.error(err);
        // Handle the error (e.g., render an error page)
        res.status(500).send('Error fetching education posts.');
    }
});


  myApp.get('/add-education', (req, res) => {
    const user = req.session.userId ? { username: req.session.username } : null;
    const Name = req.body.Name || '';  
    const Email = req.body.Email || '';
    const Description = req.body.Description || '';

res.render('add-education', { Name, Email, Description, user});
});

// After approving a blog post
const approvedBlogData = {
    Name: 'Blog Title',
    Email: 'author@example.com',
    Description: 'Lorem ipsum...',
    ImagePath: 'path/to/image.jpg',
};

const approvedBlogPost = new ApprovedPost(approvedBlogData);

approvedBlogPost.save()
    .then((savedPost) => {
        console.log('Approved blog post saved:', savedPost);
        // Handle the success, e.g., redirect to a confirmation page
    })
    .catch((error) => {
        console.error('Error saving approved blog post:', error);
        // Handle the error, e.g., show an error message
    });


// Add this route to your server code
myApp.get('/blogs', async (req, res) => {
    try {
        // Fetch approved blog posts
        const approvedBlogPosts = await ApprovedPost.find({});

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
        res.render('blogs', { groupedPosts, user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching approved posts.');
    }
});


// Edit Crowdfunding Post Route - GET
myApp.get('/edit-crowdfunding/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const crowdfundingPost = await Crowdfunding.findById(postId);

        if (!crowdfundingPost) {
            return res.status(404).send('Crowdfunding post not found.');
        }

        const user = req.session.userId ? { username: req.session.username } : null;

        res.render('edit-crowdfunding', { crowdfundingPost, user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching crowdfunding post for editing.');
    }
});

// Edit Crowdfunding Post Route - POST
myApp.post('/edit-crowdfunding/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const { Name, Email, crowdfundingType, Description } = req.body;

        // Update the crowdfunding post
        const updatedCrowdfundingPost = await Crowdfunding.findByIdAndUpdate(
            postId,
            { Name, Email, crowdfundingType, Description },
            { new: true }
        );

        if (!updatedCrowdfundingPost) {
            return res.status(404).send('Crowdfunding post not found.');
        }

        res.redirect(`/crowdfundingPost/${postId}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating crowdfunding post.');
    }
});
myApp.get('/crowdfunding/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        // Fetch the crowdfunding post details from the database
        const crowdfundingPost = await Crowdfunding.findById(postId);

        if (!crowdfundingPost) {
            return res.status(404).send('Crowdfunding post not found.');
        }

        // Render the EJS template with the crowdfunding post details
        res.render('crowdfundingPost', { crowdfundingPost });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching crowdfunding post details.');
    }
});


// Delete Crowdfunding Post Route
myApp.get('/delete-crowdfunding/:id', async (req, res) => {
    try {
        const postId = req.params.id;

        // Find the crowdfunding post to get the associated image path
        const crowdfundingPost = await Crowdfunding.findById(postId);

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

        // Delete the crowdfunding post
        await Crowdfunding.findByIdAndRemove(postId);

        res.redirect('/crowdfunding'); // Redirect to admin dashboard after deletion
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting the crowdfunding post.');
    }
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


// Admin Dashboard route
myApp.get('/admin-dashboard', async (req, res) => {
    try {

        // Fetch all education posts that are not approved
        const educationPosts = await Education.find({ approved: false });

        // Fetch all crowdfunding posts that are not approved
        const crowdfundingPosts = await Crowdfunding.find({ approved: false });

        // Pass the user data even if it's an admin
        const user = req.session.userId ? { username: "example", role: "admin" } : null;

        res.render('admin-dashboard', { user, educationPosts, crowdfundingPosts });
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
            res.redirect('/');
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error deleting the crowdfunding post.');
        });
});

const apiKey = '0a4a8f53e7014da8bb536dcb99617b76';
const apiUrl = 'https://newsapi.org/v2/top-headlines';

myApp.get('/news', async (req, res) => {
  try {
    const response = await axios.get(apiUrl, {
      params: {
        apiKey: apiKey,
        country:  ['us','ca','in','uk'],
        category: ['general','business','sports','earthquake','terrorism','earthquake','wildfire','hurricane','flood','tornado','tsunami', 'natural disaster']
      },
    });

    const articles = response.data.articles;

    // Save news to MongoDB
    const newsData = articles.map(article => ({
      headline: article.title,
      link: article.url,
     image: article.urlToImage,
    
    }));

    await News.deleteMany({}); 
    await News.insertMany(newsData);

    res.render('news', { articles, user: req.user });

  } catch (error) {
    console.error('Error fetching or saving news:', error);
    res.status(500).send('Error fetching or saving news');
  }
});

  


myApp.listen(8080, () => {
    console.log('Server is running on port 8080');
});
