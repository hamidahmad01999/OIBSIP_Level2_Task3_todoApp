const mongoose= require('mongoose');

const mongooseURI= "mongodb://127.0.0.1/todoapp"

const connectdb=async()=>{
    try {
        await mongoose.connect(mongooseURI);
        console.log("App is connected with database.")
    } catch (error) {
        console.log("Connection could not be established.")
    }
}

module.exports=connectdb;