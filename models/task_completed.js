const mongoose=require('mongoose');
const {Schema}=mongoose;

const comp_task= new Schema({
    imp_task_id:{
        type:String
    },
    imp_user_id:{
        type:String,
    },
    imp_title:{
        type:String,
    },
    imp_description:{
        type:String,
    },
    imp_date:{
        type:String,
    },
    imp_important:{
        type:String,
    }
},{timestamps:true})

module.exports =mongoose.model('complete_tasks',comp_task)