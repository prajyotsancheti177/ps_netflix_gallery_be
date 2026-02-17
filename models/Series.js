/**
 * Series Model (with embedded Seasons and Episodes)
 */
const mongoose = require('mongoose');

// Media schema (embedded in Episode)
const mediaSchema = new mongoose.Schema({
    filename: String,
    originalName: String,
    type: {
        type: String,
        enum: ['image', 'video']
    },
    url: String
}, { _id: true });

// Episode schema (embedded in Season)
const episodeSchema = new mongoose.Schema({
    title: {
        type: String,
        default: 'Episode'
    },
    thumbnail: String,
    description: String,
    music: String,
    musicOriginalName: String,
    media: [mediaSchema]
}, { _id: false });

// Season schema (embedded in Series)
const seasonSchema = new mongoose.Schema({
    title: {
        type: String,
        default: 'Season 1'
    },
    episodes: [episodeSchema]
}, { _id: false });

// Series schema
const seriesSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        default: 'My Story'
    },
    description: String,
    thumbnail: String,
    seasons: [seasonSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('Series', seriesSchema);
