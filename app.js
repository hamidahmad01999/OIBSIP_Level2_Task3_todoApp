const express = require('express')
const dbconnect = require('./dbconnect')
const path =require('path')
const ejs=require('ejs')
const bodyparser=require('body-parser');
const urlencoded= require('body-parser');
const user= require('./models/signup')
const fileUpload=require('express-fileupload')
const bcrypt = require('bcrypt');
const jwt =require('jsonwebtoken');
const {body, validationResult} =require('express-validator')
const cookieParser = require('cookie-parser');
const task= require('./models/task')
const task_completed= require('./models/task_completed')
// const flash= require('express-flash-message')
const flash = require('connect-flash');
const session=require('express-session');
const otpmodel=require('./models/otp')
const nodemailer=require('nodemailer')


const app = express()
const port = 3200

dbconnect();

// const urlencodedparser=require(bodyparser.urlencoded({extended:true}))
app.set('view engine', 'ejs')


const validatemiddleware=async(req,res,next)=>{
    if(req.files==null){
       
       return res.render('signup', {data:"Upload your image with tittle."})
        
    }
    next();
}
const validatemiddlewaretodo=async(req,res,next)=>{
    let {name, emial, image}=req.user
    if(req.files==null){
       
       return res.render('todo', {name:name, image:image, email:"email", todo:true})
        
    }
    next();
}

// this transporter is actually for nodemailer which is sending mail to user to verify email
const transporter= nodemailer.createTransport({
    service:"gmail",
    auth:{
        user:"hamidahmad5981@gmail.com",
        pass:"aeivadvoeqyrvlgo"
    }
})


const isAuth= async(req,res,next)=>{
    let token = req.cookies.token

    if(token){
        let jwt_compare =jwt.verify(token, 'iamsecret')

        let user_id = jwt_compare._id

        let user_data = await user.findById(user_id);
        if(!user_data.verified){
            req.flash('message',"Please verify your account.")
            res.redirect('/signup')
        }else{
                req.flash('message',"Please verify your account.")
                res.redirect('/signup')
        }
        req.user=user_data;
        next()
    }
    else{
        res.redirect('/signin')
    }
}


app.use(express.json());
app.use(express.urlencoded());
app.use(express.static(__dirname +('/public')))
app.use(fileUpload())
app.use(cookieParser());
app.use(session({
    secret:"Secret",
    cookie:{maxAge:60000},
    saveUninitialized:false,
    resave:false
}))
app.use(flash())



app.get("/", (req,res)=>{
    res.render('index');
})


app.get('/signup', (req,res)=>{
    let messages = req.flash().message || "";
    res.render('signup', {data:"", messages});
})


app.post('/signup',validatemiddleware,async(req,res)=>{
    let {name, email,images, password} = req.body;
    let image=req.files.image;
    let image_name=image.name;

    let salt=await bcrypt.genSaltSync(10)
    let securepassword =await bcrypt.hashSync(password, salt);

    let emailfind= await user.findOne({email:email})
    if(emailfind){
        // res.render('signup',{data:"User with this email already exists."})
        req.flash('message', "Email already exists.")
        return res.redirect('/signup');
    }else{
        console.log(image_name)
        if(image_name.includes('.jpg') || image_name.includes('.jpeg') || image_name.includes('.png')){
            image.mv(path.resolve(__dirname, 'public/images', image.name),
            async(error)=>{
                let newuser=await user.create({
                    // ...req.body,
                    name:name,
                    email:email,
                    password:securepassword,
                    verified:false,
                    image: '/images/'+ image.name
                })
                // res.render('signup',{data:"User Created Successfully"})
                sendotpverification(newuser, res)
                // req.flash("message","User created successfully.")
                // return res.redirect('/signup')
                res.cookie('userid', newuser._id,{
                    httpOnly:true,
                    expires: new Date(Date.now() + 60*100000)
                });
                // return res.redirect(`/otp?id=${newuser._id}`)
                return res.redirect('/otp')
                
            })
        }else{
            // res.render('signup',{data:"Upload image with extension jpg, jpeg or png."})
            req.flash("message", "Upload image with extension jpg, jpeg or png")
            res.redirect('/signup')
        }
    }

})

sendotpverification=async({_id, email},res)=>{
    let otp= `${Math.floor(1000+Math.random()*9000)}`;
    console.log(otp)
    let createotp=await otpmodel.create({
        userId: _id,
        email:email,
        otp:otp,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000
    })

    await transporter.sendMail({
        from:"Todo App",
        to:email,
        subject:"OTP Verification",
        html:`This is the verification otp  <b>${otp}</b>  for your account so please don't share it with anyone. `
    })    

}

app.get('/otp', (req,res)=>{
    userid = req.cookies.userid;
    // userid=req.query.id || "";
    console.log(`this is get user id ${userid}`);
    let messages =req.flash().message || "";
    res.render('otp', {messages})
    console.log(messages)
})
app.post("/otp", async(req,res)=>{
    let myotp= req.body.otp;
    console.log(`this is  my ${myotp}`)
    console.log(userid)
    let getuser= await otpmodel.find({userId:userid})
    let otp= getuser[0].otp;
    console.log(getuser.otp)
    console.log(getuser)
    console.log(`this is real otp ${otp}`)

    if(otp==myotp){
        console.log("OTP MAtched")
        // let realuser= await user.findByIdAndUpdate({_Id:userid}, {verified:true});
        let realuser = await user.findById(userid);
        console.log(realuser)
        await realuser.updateOne({verified:true});
        // await realuser.create({
        //     verified: true,
        // })
        await otpmodel.deleteMany({userId:userid})
        req.flash('message', "Your acccount has been verified.")
        res.redirect('/otp');
    }else{
        res.send("Error")
    }
    

})
app.post('/resendotp',(req,res)=>{
    
})

app.get('/signin', (req,res)=>{
    res.render('signin', {data:""})
})

app.post('/signin', async(req,res)=>{
    let {email, password} = req.body;
    console.log(email, password)
    let check_user= await user.findOne({email: email})

    if(check_user){
        let compare_password = await bcrypt.compare(password, check_user.password);
        if(compare_password){
            let jwt_token= jwt.sign({_id: check_user._id}, 'iamsecret');

            res.cookie('token', jwt_token,{
                httpOnly:true,
                expires: new Date(Date.now() + 60*100000)
            });
            res.redirect('/todo')
        }else{
            res.render('signin',{data:"You entered incorrect credentials."})
        }
    }else{
        res.render('signin',{data:"You entered incorrect credentials."})
    }

})


app.get('/todo', isAuth,async(req, res) => { 
    
    // actually I am getting name,email, image, _id from req.user which actually I am getting from isAuth middleware function
    let {name, email, image, _id}=req.user;
    let task_data= await task.find({user_id:_id, completed:false});
    let task_data_comp= await task.find({user_id:_id, completed:true});
    let task_data_important= await task.find({user_id:_id,important:"yes",completed:false});
    console.log(task_data)
    res.render('todo', {
        todo:true, name:name, email:email, image:image, id:_id, data:"",alltasks:task_data, important:task_data_important, 
        task_data_comp:task_data_comp
    })
})

// I created a middle ware (validatemiddlewaretodo) for todo page to check whether user uploading image or not but I think we don't need this so that's why I am not using that middleware here.
app.post('/todo', isAuth,async(req, res) => {
    
    let task_data= await task.find({});
    let {name, email, _id}=req.user;
    let user_image=req.user.image;
    let {title, description, important, user_id, taskdate} = req.body;
    
    if(req.files){
        let image=req.files.image;
        let image_name=image.name;
        console.log(image_name);
        if(image_name.includes('.jpg') || image_name.includes('.png') || image_name.includes('.jpeg')){
            console.log("Yes")
            image.mv(path.resolve(__dirname, 'public/task_img', image.name),
                async(error)=>{
                    await task.create({
                        user_id:user_id,
                        title: title,
                        description:description,
                        important:important,
                        taskdate:taskdate,
                        completed:false,
                        image: '/task_img/' + image.name 
                    })
                    // res.status(303).render('todo', {name:name, image:user_image, email:"email", id:_id,todo:true,
                    // data:"Task added successfully", alltasks:task_data})
                    return res.redirect('/dumy')
                    // res.redirect('/todo')
                }
                )
    }else{
        console.log("In else")
        // return res.render('todo', {
        //     todo:true, name:name, email:email, image:image, id:_id, data:"Please upload image with JPG, PNG and JPEG.",alltasks:task_data, important:task_data_important
        // })
        return res.redirect('/dumy')
    }
    }else{
        console.log("In error")
        await task.create({
            user_id:user_id,
            title: title,
            description:description,
            important:important,
            taskdate:taskdate,
        })
        res.redirect('/dumy')
    }
})

app.get('/dumy',isAuth,async(req,res)=>{
    res.redirect('/todo')
})

app.get('/logout',async(req,res)=>{
    res.cookie('token', null,{
        httpOnly:true,
        expires: new Date(Date.now())
    })
    res.redirect('/signin')
})

app.get('/deletetodo/:id', async(req, res)=>{
    let id = req.params.id

    await task.findByIdAndDelete(id)
    res.redirect('/todo')
})

app.get('/todotask/:id', async(req,res)=>{
    let id = req.params.id;

    let todotask = await task.findById(id)
    console.log(todotask);
    res.render('todotask', {todo:true, task:todotask})
    
})

// Here in this function actually I am updating task, if I completed any task so it will go to another section of todo page.
app.get('/task/completed/:id', async (req, res) =>{
    let my_comp_task_id=req.params.id;
    // let my_comp_task=await task.findById(my_comp_task_id);
    let my_comp_task= await task.findByIdAndUpdate(my_comp_task_id, {completed:true});
    console.log(my_comp_task)
    
    let my_comp_task1=await task.findById(my_comp_task_id)
    // console.log(my_comp)
    res.redirect('/todo')
})

// app.get('/task/completed/:id', async(req,res)=>{
//     let my_comp_task_id=req.params.id;
//     let my_comp_task=await task.findById(my_comp_task_id);
//     console.log(my_comp_task)
//     let {_id, user_id, title, description,taskdate,important}=my_comp_task;
//     console.log(title)


//     res.redirect('/todo')
// })


app.listen(port, ()=>{
    console.log(`listening on port ${port}.`)
})