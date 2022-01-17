const express = require('express'),
	app = express(),
	mongoose = require("mongoose"),
	passport = require("passport"),
	bodyParser = require("body-parser"),
	LocalStrategy = require("passport-local"),
	passportLocalMongoose = require("passport-local-mongoose"),
	User = require("./models/user"),
	File = require("./models/file");
var fs = require('fs');
var path = require('path');
const { check, validationResult } = require('express-validator');

require('dotenv/config');

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true }, err => {
	console.log('connected to ' + process.env.MONGO_URL)
});

app.use(require("express-session")({
	secret: "password",
	resave: false,
	saveUninitialized: false
}));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
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
app.get("/error", (req, res) => {
	res.render("error");
})
app.get("/profile", isLoggedIn, (req, res) => {
	writeToLog("in", req.user.username);
	res.render("profile", { username: req.user.username });
})
app.get("/login", (req, res) => {
	res.render("login", { msg: "" });
});
app.get("/logout", (req, res) => {
	writeToLog("out", req.user.username);
	req.logout();
	res.redirect("/");
});
app.get("/register", (req, res) => {
	res.render("register", { error: "Password: 8 Letters" });
});


/*
-------UPLOAD ROUTES---------
*/
app.get('/uploadFiles', isLoggedIn, (req, res) => {
	File.find({}, (err, items) => {
		if (err) {
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
			size: (element.size / 1000000).toFixed(3),
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
	res.redirect('containers');
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

app.post("/register", check("username").isLength({ min: 3 }),
	check("email").isEmail(),
	check("password").isLength(8), (req, res) => {

		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.render('register', { error: "Invalid Password/Email." });
		}

		User.register(new User({ username: req.body.username, email: req.body.email, admin: 0 }), req.body.password, function (err, user) {
			if (err) {
				console.log(err);
				res.render("register", { error: "Password: 8 Letters" });
			}
			passport.authenticate("local")(req, res, function () {
				res.redirect("/login");
			});
		});
	});

/*
---------DELETE / DOWNLOAD & SEARCH ROUTES----------
*/
app.get('/delete/:name', (req, res) => {
	try {
		File.findOneAndDelete({ author: req.user.username, name: req.params.name }, function (err, docs) {
			if (err) {
				console.log(err)
			}
			else {
				try {
					fs.unlinkSync(path.join(__dirname + '/uploads/' + req.params.name));
				} catch (error) {
				}
			}
		});
		res.redirect('back');
	} catch (error) {
		res.render('containers');
	}
});

app.get('/download/:name', (req, res) => {
	try {
		res.send(fs.readFileSync(path.join(__dirname + '/uploads/' + req.params.name)));
	} catch (error) {
		res.redirect('/error');
	}
});

app.post('/search', (req, res) => {
	if (!req.body.searchQ == "") {
		const s = req.body.searchQ;
		const regex = new RegExp(s, 'i'); // i for case insensitive
		File.find({ author: req.user.username, name: { $regex: regex } }, (err, items) => {
			if (err) {
				console.log(err);
				res.redirect('error');
			} else {
				res.render('containers', { items: items });
			}
		});
	} else {
		File.find({}, (err, items) => {
			if (err) {
				console.log(err);
				res.redirect('error');
			} else {
				res.render('containers', { items: items });
			}
		});
	}
});

/*
------ADMIN ROUTES
*/
app.get("/admin", (req, res) => {
	User.findOne({ username: req.user.username, admin: 1 }, (err, admin) => {
		if (!admin | err) {
			res.redirect('profile');
		} else {
			User.find({ admin: 0 }, (err, users) => {
				if (err) {
					console.log(err);
				} else {
					res.render("admin", { users: users });
				}
			});
		}
	});
});
app.post('/searchUsr', (req, res) => {
	if (req.body.searchQQ != "") {
		const s = req.body.searchQQ;
		const r = new RegExp(s, 'i'); // i for case insensitive
		User.find({ username: { $regex: r }, admin:0 }, (err, usrs) => {
			if (err) {
				console.log(err);
				res.redirect('error');
			} else {
				res.render('admin', { users: usrs });
			}
		});
	} else {
		User.find({ admin: 0 }, (err, users) => {
			if (err) {
				console.log(err);
				res.redirect('error');
			} else {
				res.render('admin', { users: users });
			}
		});
	}
});
app.get('/promote/:id', (req, res) => {
	console.log(req.params.id);
	User.findOneAndUpdate({ username: req.params.id }, { admin: 1 }, (err) => {
		console.log(err);
	});
	res.redirect('back');
});
app.get('/deleteUsr/:name', (req, res) => {
	try {
		User.findOneAndDelete({ username: req.params.name }, function (err, docs) {
			if (err) {
				console.log(err);
			}
			else {
				console.log("deleted");
			}
		});
		res.redirect('back');
	} catch (error) {
		res.redirect('back');
	}
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

function writeToLog(txt, usr) {
	const timeElapsed = Date.now();
	const today = new Date(timeElapsed);
	var logtxt = `------${today.toUTCString()}-----\n User ${usr} logged ${txt} successfully.\n----------------------------------------\n\n`;

	fs.appendFileSync('logs/log.txt', logtxt);
}
