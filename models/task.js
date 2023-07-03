const mongoose = require('mongoose');
const { Schema } = mongoose;

let today = new Date();
today = toString(today.setHours(0, 0, 0, 0));
console.log(typeof(today))

const taskSchema = new Schema({
    user_id: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: false,
    },

    image: {
        type: String,
        required: false
    },
    important: {
        type: String,
    },
    taskdate: {
        type: String,
        // default: today,
    },
    completed: {
        type: Boolean
    }
}, { timestamps: true })

module.exports = mongoose.model('tasks', taskSchema)