const mongoose=require('mongoose');
const {Schema}=mongoose;

const userSchema=new Schema({
    name:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    image:{
        type:String,
        required:false,
    },
    password:{
        type:String,
        required:true
    },
    verified:{
        type:Boolean,
    }
}, {timestamps:true});

module.exports= mongoose.model('Create_User', userSchema)