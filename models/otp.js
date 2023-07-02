const mongoose=require('mongoose');
const {Schema}=mongoose;

const otpSchema= new Schema({
    userId:{
        type:String,
        required:true
    },
    email:{
        type:String
    },
    otp:{
        type:Number,
        required:true,
    },
    createdAt:{
        type:Date
    },
    expiresAt:{
        type:Date
    }
},{timestamps:true});

module.exports= mongoose.model('otp', otpSchema)