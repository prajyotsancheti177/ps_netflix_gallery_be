/**
 * Profile Model
 */
const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: 'New Profile'
    },
    avatar: {
        type: String,
        default: '😊'
    },
    color: {
        type: String,
        default: '#e50914'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Profile', profileSchema);
