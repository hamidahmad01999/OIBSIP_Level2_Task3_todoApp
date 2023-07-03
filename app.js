// Author Name : Hamid Ahmad
// Project Submit Date : 03 July 2023
// Project Name : Todo Application
// Project Description : It used EJS, CSS, JS, Bootstrap, Fontawesome, Mongoose, Express, Node JS, Bcrypt JS, JWT Token,Express File Upload, flash, nodemailer etc.

// things plan to add in future in this project : profile edit for user, use express validation for validation

// pacakages required for development
const express = require('express')
const dbconnect = require('./dbconnect')
const path = require('path')
const ejs = require('ejs')
const bodyparser = require('body-parser');
const urlencoded = require('body-parser');
const user = require('./models/signup')
const fileUpload = require('express-fileupload')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator')
const cookieParser = require('cookie-parser');
const task = require('./models/task')
const task_completed = require('./models/task_completed')
const flash = require('connect-flash');
const session = require('express-session');
const otpmodel = require('./models/otp')
const nodemailer = require('nodemailer')


// -----------------------------------------------------------------------

const app = express()
const port = 3200

dbconnect();

// using ejs template engine
app.set('view engine', 'ejs')

// my own middlewares for routes

// middle for checking wheter user is uploading image or not and I used this 
const validatemiddlewaresignup = async(req, res, next) => {
    if (req.files == null || req.body.name == "" || req.body.email == "" || req.body.password == "") {
        req.flash('message', "Please enter name, email, password and upload image.")
        return res.redirect('/signup')

    }


    next();
}

// this middleware is for signin page to check wether using is entering his email or password
const validatemiddlewaresignin = async(req, res, next) => {
    if (req.body.email == "" || req.body.password == "") {
        req.flash('signin_message', "Please enter your email and password")
        return res.redirect('/signin')
    }
    next();
}

// this middleware is for checking whether user entering date while entering data for todo task in todo page
const validatedateandnametod = async(req, res, next) => {
    if (req.body.taskdate == "" || req.body.title == "") {
        req.flash('todo_message', "It is must to add task tittle and date")
        return res.redirect('/todo')
    }
    next();
}


const validatemiddlewaretodo = async(req, res, next) => {
    let { name, emial, image } = req.user
    if (req.files == null) {

        // return res.render('todo', { name: name, image: image, email: "email", todo: true })
        return res.redirect('/signup')
    }
    next();
}

// this transporter is actually for nodemailer which is sending mail to user to verify email
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "hamidahmad5981@gmail.com",
        pass: "aeivadvoeqyrvlgo"
    }
})

// this is middleware for authenticate to todo page
const isAuth = async(req, res, next) => {
    let token = req.cookies.token

    if (token) {
        let jwt_compare = jwt.verify(token, 'iamsecret')

        let user_id = jwt_compare._id

        let user_data = await user.findById(user_id);



        req.user = user_data;
        next()
    } else {
        return res.redirect('/signin')
    }
}

// middle for otp that only authorized user can get acces to otp page
const otp_auth = async(req, res, next) => {
    check_userid = req.cookies.userid;
    if (check_userid) {
        return next();
    }
    return res.redirect('/signup')
}


// ------------------------------------------------------------------------------------

// using build-In middlewares and other pacakages
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static(__dirname + ('/public')))
app.use(fileUpload()) //for file uploading
app.use(cookieParser()); //for cookies

//this session is compulsory for using connect-flash (flash)
app.use(session({
    secret: "Secret",
    cookie: { maxAge: 60000 },
    saveUninitialized: false,
    resave: false
}))
app.use(flash())

// ------------------------------------------------------------------------------------
//ROUTES
// home page rendering
app.get("/", (req, res) => {
    try {
        res.render('index');

    } catch (error) {
        res.send("Internal Server Error!")
    }
})

// sign up page rendering
app.get('/signup', async(req, res) => {
    try {
        let delteusers = await user.find({ verified: false });
        console.log(delteusers)
        await user.deleteMany({ verified: false })
            // this message is generated by using connect-flash pacakage
        let messages = req.flash().message || "";

        res.render('signup', { data: "", messages });
    } catch (error) {
        res.send("Internal Server Error.")
    }
})

//handling post request from singup page
app.post('/signup', validatemiddlewaresignup, async(req, res) => {
    try {
        let { name, email, images, password } = req.body;
        let image = req.files.image;
        let image_name = image.name;
        // console.log(name, email, password)

        // secring password using bcrypt
        let salt = await bcrypt.genSaltSync(10)
        let securepassword = await bcrypt.hashSync(password, salt);

        // check wether user with this email already exists or not
        let emailfind = await user.findOne({ email: email })

        if (emailfind) {

            // flash massage using connect-flash
            req.flash('message', "Email already exists.")
            return res.redirect('/signup');
        } else {
            // console.log(image_name)
            // checking whether user is only uploading image because express-fileupload pacakage can use to upload any kind of file
            if (image_name.includes('.jpg') || image_name.includes('.jpeg') || image_name.includes('.png')) {
                image.mv(path.resolve(__dirname, 'public/images', image.name),
                    async(error) => {
                        let newuser = await user.create({
                                // ...req.body,
                                name: name,
                                email: email,
                                password: securepassword,
                                verified: false,
                                image: '/images/' + image.name
                            })
                            // res.render('signup',{data:"User Created Successfully"})
                        sendotpverification(newuser, res)

                        let newuser_id = jwt.sign({ id: newuser._id }, "otp secret")


                        res.cookie('userid', newuser_id, {
                            httpOnly: true,
                            expires: new Date(Date.now() + 60000)
                        });
                        // actually below line is for query in headers
                        // return res.redirect(`/otp?id=${newuser._id}`)

                        return res.redirect('/otp')

                    })
            } else {
                req.flash("message", "Upload image with extension jpg, jpeg or png")
                return res.redirect('/signup')
            }
        }

    } catch (error) {
        req.flash("messages", "Internal Server Error")
        return res.redirect('/signup')
    }
})

// This function is sending otp to user using nodemailer package 
sendotpverification = async({ _id, email }, res) => {
    // generating as a string I think it does not work without string but you can check
    let otp = `${Math.floor(1000+Math.random()*9000)}`;
    // console.log(otp)
    let createotp = await otpmodel.create({
        userId: _id,
        email: email,
        otp: otp,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000
    })

    // sending email to user using nodemailer 
    await transporter.sendMail({
        from: "Todo App",
        to: email,
        subject: "OTP Verification",
        html: `This is the verification otp  <b>${otp}</b>  for your account so please don't share it with anyone. `
    })

}

app.get('/otp', otp_auth, async(req, res) => {
    userid = req.cookies.userid;
    console.log(`type of cookie is ${req.cookie}`)
    jwt_otp_compare = await jwt.verify(userid, "otp secret")

    userid = jwt_otp_compare.id;
    let useremail = await otpmodel.find({ userId: userid })
    useremail = useremail[0].email || "not available";
    // userid=req.query.id || "";
    console.log(`this is get user id ${userid}`);
    let messages = req.flash().message || "";
    let email = req.flash().email || "";
    res.render('otp', { messages, email: useremail })
    console.log(messages)
})
app.post("/otp", async(req, res) => {
    let myotp = req.body.otp;
    console.log(`this is  my ${myotp}`)
    console.log(userid)
    let getuser = await otpmodel.find({ userId: userid })
    let otp = getuser[0].otp;
    let { expiresAt } = getuser
    console.log(`this is require ${otp, expiresAt}`)
    console.log(getuser)
    console.log(`this is real otp ${otp}`)
    if (!myotp) {
        req.flash('message', "Please enter OTP to verify.")
        console.log("!otp")
        return res.redirect('/otp')
    } else {
        if (getuser) {
            console.log("getuser")
            if (expiresAt < Date.now()) {
                console.log("Expires")
                res.cookie('userid', null, {
                    httpOnly: true,
                    expires: new Date(Date.now())
                })
                await otpmodel.deleteMany({ userId: userid })
                req.flash("message", "Time exiperes to enter OTP so register agian.")
                return res.redirect("/signup")

            } else {
                if (otp == myotp) {
                    console.log("OTP MAtched")
                        // let realuser= await user.findByIdAndUpdate({_Id:userid}, {verified:true});
                    let realuser = await user.findById(userid);
                    console.log(realuser)
                    await realuser.updateOne({ verified: true });

                    await otpmodel.deleteMany({ userId: userid })
                    res.cookie('userid', null, {
                        httpOnly: true,
                        expires: new Date(Date.now())
                    })
                    req.flash('message', "Your acccount has been verified.")
                    return res.redirect('/otp');
                } else {
                    res.cookie('userid', null, {
                        httpOnly: true,
                        expires: new Date(Date.now())
                    })
                    await otpmodel.deleteMany({ userId: userid })
                    req.flash("message", "You entered wrong otp.")
                    return res.redirect("/signup")
                }
            }
        } else {
            res.cookie('userid', null, {
                httpOnly: true,
                expires: new Date(Date.now())
            })
            cosnole.log("NO uer")
            req.flash("message", "User does not exist")
            return res.redirect('/signup')
        }
    }




})

app.post('/resendotp', (req, res) => {

})

app.get('/signin', (req, res) => {
    let signin_message = req.flash().signin_message || ""
    res.render('signin', { signin_message })
})

app.post('/signin', validatemiddlewaresignin, async(req, res) => {
    let { email, password } = req.body;
    console.log(email, password)
    let check_user = await user.findOne({ email: email, verified: true })

    if (check_user) {
        let compare_password = await bcrypt.compare(password, check_user.password);
        if (compare_password) {
            let jwt_token = jwt.sign({ _id: check_user._id }, 'iamsecret');

            res.cookie('token', jwt_token, {
                httpOnly: true,
                expires: new Date(Date.now() + 60 * 100000)
            });
            return res.redirect('/todo')
        } else {
            // return res.render('signin', { data: "You entered incorrect credentials." })
            req.flash('signin_message', "You entered incorrect credentials")
            return res.redirect('/signin')
        }
    } else {
        // res.render('signin', { data: "You entered incorrect credentials or not verified." })
        req.flash('signin_message', "User does not exist or not verified.")
        return res.redirect('/signin')
    }

})


app.get('/todo', isAuth, async(req, res) => {

    // actually I am getting name,email, image, _id from req.user which actually I am getting from isAuth middleware function
    let { name, email, image, _id } = req.user;
    let task_data = await task.find({ user_id: _id, completed: false });
    console.log(task_data)
    let task_data_comp = await task.find({ user_id: _id, completed: true });
    console.log(task_data_comp)
    let task_data_important = await task.find({ user_id: _id, important: "yes", completed: false });
    console.log(task_data)
    let todo_message = req.flash().todo_message || ""

    res.render('todo', {
        todo: true,
        name: name,
        email: email,
        image: image,
        id: _id,
        data: "",
        alltasks: task_data,
        important: task_data_important,
        task_data_comp: task_data_comp,
        todo_message: todo_message
    })
})

// I created a middle ware (validatemiddlewaretodo) for todo page to check whether user uploading image or not but I think we don't need this so that's why I am not using that middleware here.
app.post('/todo', isAuth, validatedateandnametod, async(req, res) => {

    let task_data = await task.find({});
    let { name, email, _id } = req.user;
    let user_image = req.user.image;
    let { title, description, important, user_id, taskdate } = req.body;

    if (req.files) {
        let image = req.files.image;
        let image_name = image.name;
        console.log(image_name);
        if (image_name.includes('.jpg') || image_name.includes('.png') || image_name.includes('.jpeg')) {
            console.log("Yes")
            image.mv(path.resolve(__dirname, 'public/task_img', image.name),
                async(error) => {
                    await task.create({
                            user_id: user_id,
                            title: title,
                            description: description,
                            important: important,
                            taskdate: taskdate,
                            completed: false,
                            image: '/task_img/' + image.name
                        })
                        // res.status(303).render('todo', {name:name, image:user_image, email:"email", id:_id,todo:true,
                        // data:"Task added successfully", alltasks:task_data})
                        // return res.redirect('/dumy')
                    req.flash('todo_message', "Task added successfully")
                    res.redirect('/todo')
                }
            )
        } else {
            console.log("In else")
                // return res.render('todo', {
                //     todo:true, name:name, email:email, image:image, id:_id, data:"Please upload image with JPG, PNG and JPEG.",alltasks:task_data, important:task_data_important
                // })
            req.flash('todo_message', "Please upload image with JPG, PNG and JPEG.")
            return res.redirect('/todo')
        }
    } else {
        console.log("In error")
        await task.create({
            user_id: user_id,
            title: title,
            description: description,
            important: important,
            taskdate: taskdate,
            completed: false
        })
        req.flash('todo_message', "Task added successfully")
        return res.redirect('/todo')
    }
})

app.get('/dumy', isAuth, async(req, res) => {
    res.redirect('/todo')
})

app.get('/logout', async(req, res) => {
    res.cookie('token', null, {
        httpOnly: true,
        expires: new Date(Date.now())
    })
    res.redirect('/signin')
})

app.get('/deletetodo/:id', async(req, res) => {
    let id = req.params.id

    await task.findByIdAndDelete(id)
    res.redirect('/todo')
})

app.get('/todotask/:id', async(req, res) => {
    let id = req.params.id;

    let todotask = await task.findById(id)
    console.log(todotask);
    res.render('todotask', { todo: true, task: todotask })

})

// Here in this function actually I am updating task, if I completed any task so it will go to another section of todo page.
app.get('/task/completed/:id', async(req, res) => {
    let my_comp_task_id = req.params.id;
    // let my_comp_task=await task.findById(my_comp_task_id);
    let my_comp_task = await task.findByIdAndUpdate(my_comp_task_id, { completed: true });
    console.log(my_comp_task)

    let my_comp_task1 = await task.findById(my_comp_task_id)
        // console.log(my_comp)
    res.redirect('/todo')
})




app.listen(port, () => {
    console.log(`listening on port ${port}.`)
})