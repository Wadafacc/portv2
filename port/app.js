const express = require('express'),
	app = express(),
	mongoose = require("mongoose"),
	passport = require("passport"),
	bodyParser = require("body-parser"),
	LocalStrategy = require("passport-local"),
	passportLocalMongoose = require("passport-local-mongoose"),
	User = require("./models/user");
File = require("./models/file");

require('dotenv/config');

var fs = require('fs');
var path = require('path');

//Connecting database
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true }, err => {
	console.log('connected to ' + process.env.MONGO_URL)
});

app.use(require("express-session")({
	secret: "password",       //decode or encode session
	resave: false,
	saveUninitialized: false
}));

passport.serializeUser(User.serializeUser());       //session encoding
passport.deserializeUser(User.deserializeUser());   //session decoding
passport.use(new LocalStrategy(User.authenticate()));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded(
	{ extended: true }
))

app.use(bodyParser.json())
app.use(express.static(__dirname));
app.use(passport.initialize());
app.use(passport.session());
app.use(function (err, req, res, next) {
	if (err) {
		res.redirect('error');
	}
})
//const { populate } = require('./models/user');

var multer = require('multer');

var storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'uploads')
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname)
	}
});

var upload = multer({ storage: storage });

//=======================
//      R O U T E S
//=======================

/*
--------BASE ROUTES---------
*/
app.get("/", (req, res) => {
	res.render("home");
})
app.get("error", (req, res) => {
	res.render("error");
})
app.get("/profile", isLoggedIn, (req, res) => {
	res.render("profile", { username: req.user.username });
})
//Auth Routes
app.get("/login", (req, res) => {
	res.render("login");
});
app.get("/logout", (req, res) => {
	req.logout();
	res.redirect("/");
});
app.get("/register", (req, res) => {
	res.render("register");
});


/*
-------UPLOAD ROUTES---------
*/
app.get('/uploadFiles', isLoggedIn, (req, res) => {
	File.find({}, (err, items) => {
		if (err) {
			//console.log('storing ERROR')
			console.log(err);
			res.status(500).send('An error occurred', err);
		}
		else {
			res.render('uploadFiles', { items: items });
		}
	});
});

app.post('/upload', upload.array('file'), (req, res, next) => {

	const files = req.files

	files.forEach(element => {
		var obj = {
			author: req.user.username,
			name: element.filename,
			size: element.size / 1000,
			file: {
				data: fs.readFileSync(path.join(__dirname + '/uploads/' + element.filename)),
				contentType: 'file'
			}
		}
		File.create(obj, (err, item) => {
			if (err) {
				console.log(err);
			}
			else {
			}
		});
	});
	res.redirect('uploadFiles');

});

app.get('/containers', isLoggedIn, (req, res) => {
	File.find({ author: req.user.username }, (err, items) => {
		if (err) {
			console.log(err);
			res.status(500).send('An error occurred', err);
		}
		else {
			res.render('containers', { items: items });
		}
	});
});


/*
--------LOGIN / REGISTER ROUTES-----------
*/

app.post("/login", passport.authenticate("local", {
	successRedirect: "/profile",
	failureRedirect: "/login"
}), function (req, res) { });

app.post("/register", (req, res) => {

	User.register(new User({ username: req.body.username, email: req.body.email }), req.body.password, function (err, user) {
		if (err) {
			console.log(err);
			res.render("register");
		}
		passport.authenticate("local")(req, res, function () {
			res.redirect("/login");
		});
	});
});



/*
---------DELETE / DOWNLOAD ROUTES----------
*/
app.get('/delete/:name', (req, res) => {
	File.findOneAndDelete({ author: req.user.username, name: req.params.name }, function (err, docs) {
		if (err) {
			console.log(err)
		}
		else {
			fs.unlinkSync(path.join(__dirname + '/uploads/' + req.params.name));
			console.log("Deleted File : ");
		}
	});
	res.redirect('back');

});

app.get('/download/:name', (req, res) => {
	res.send(fs.readFileSync(path.join(__dirname + '/uploads/' + req.params.name)));
});



/*
--------LISTENER--------
*/
app.listen(process.env.PORT || 3000, function (err) {
	if (err) {
		console.log(err);
	} else {
		console.log("Server Started At Port " + `http://localhost:` + process.env.PORT);
	}
});


/*
--------FUNCTIONS---------
*/
function isLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	res.redirect("login");
}