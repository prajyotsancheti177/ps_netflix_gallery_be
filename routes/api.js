/**
 * Netflix Life Story - API Routes (MongoDB Version)
 * Handles file uploads to AWS S3 and data management with MongoDB
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const {
    seriesThumbnailStorage,
    thumbnailStorage,
    mediaStorage,
    musicStorage,
    getS3Url,
    deleteFromS3,
    getKeyFromUrl
} = require('../config/s3');
const Profile = require('../models/Profile');
const Series = require('../models/Series');

const router = express.Router();

// Configure multer with S3 storage
const uploadSeriesThumbnail = multer({
    storage: seriesThumbnailStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const ext = path.extname(file.originalname).toLowerCase().slice(1);
        cb(null, allowedTypes.test(ext));
    }
});

const uploadThumbnail = multer({ 
    storage: thumbnailStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const ext = path.extname(file.originalname).toLowerCase().slice(1);
        cb(null, allowedTypes.test(ext));
    }
});

const uploadMedia = multer({ 
    storage: mediaStorage,
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|webm|mkv/;
        const ext = path.extname(file.originalname).toLowerCase().slice(1);
        cb(null, allowedTypes.test(ext));
    }
});

const uploadMusic = multer({
    storage: musicStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp3|wav|ogg|m4a|aac/;
        const ext = path.extname(file.originalname).toLowerCase().slice(1);
        cb(null, allowedTypes.test(ext));
    }
});

// Helper: get episode from series by season/episode index
function getEpisode(series, seasonIndex, episodeIndex) {
    if (seasonIndex >= series.seasons.length) return null;
    const season = series.seasons[seasonIndex];
    if (episodeIndex >= season.episodes.length) return null;
    return season.episodes[episodeIndex];
}

// Helper: delete all S3 assets for an episode
async function deleteEpisodeAssets(episode) {
    if (episode.thumbnail) {
        const key = getKeyFromUrl(episode.thumbnail);
        if (key) await deleteFromS3(key);
    }
    if (episode.music) {
        const key = getKeyFromUrl(episode.music);
        if (key) await deleteFromS3(key);
    }
    for (const media of episode.media || []) {
        const key = getKeyFromUrl(media.url);
        if (key) await deleteFromS3(key);
    }
}

// Helper: delete all S3 assets for a season
async function deleteSeasonAssets(season) {
    for (const episode of season.episodes) {
        await deleteEpisodeAssets(episode);
    }
}

// ============================================
// PROFILE ROUTES
// ============================================

// GET /api/profiles - Get all profiles
router.get('/profiles', async (req, res) => {
    try {
        const profiles = await Profile.find().sort({ createdAt: 1 });
        res.json(profiles);
    } catch (error) {
        console.error('Error getting profiles:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/profiles - Create new profile
router.post('/profiles', async (req, res) => {
    try {
        const { name, avatar, color } = req.body;
        const profile = await Profile.create({
            name: name || 'New Profile',
            avatar: avatar || '😊',
            color: color || '#e50914'
        });
        res.json({ success: true, profile });
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/profiles/:id - Update profile
router.put('/profiles/:id', async (req, res) => {
    try {
        const { name, avatar, color } = req.body;
        const profile = await Profile.findByIdAndUpdate(
            req.params.id,
            { name, avatar, color },
            { new: true }
        );
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json({ success: true, profile });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/profiles/:id - Delete profile
router.delete('/profiles/:id', async (req, res) => {
    try {
        const profile = await Profile.findByIdAndDelete(req.params.id);
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting profile:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SERIES ROUTES
// ============================================

// GET /api/series - Get all series
router.get('/series', async (req, res) => {
    try {
        const series = await Series.find().sort({ createdAt: -1 });
        res.json(series);
    } catch (error) {
        console.error('Error getting series:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/series/:id - Get single series
router.get('/series/:id', async (req, res) => {
    try {
        const series = await Series.findById(req.params.id);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        res.json(series);
    } catch (error) {
        console.error('Error getting series:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/series - Create new series
router.post('/series', async (req, res) => {
    try {
        const { title, description, seasonCount, episodesPerSeason } = req.body;
        const numSeasons = Math.min(Math.max(seasonCount || 1, 1), 10);
        const numEpisodes = Math.min(Math.max(episodesPerSeason || 1, 1), 10);
        
        // Create seasons with episodes
        const seasons = Array.from({ length: numSeasons }, (_, si) => ({
            title: `Season ${si + 1}`,
            episodes: Array.from({ length: numEpisodes }, (_, ei) => ({
                title: `Episode ${ei + 1}`,
                thumbnail: null,
                description: '',
                music: null,
                musicOriginalName: null,
                media: []
            }))
        }));
        
        const series = await Series.create({
            title: title || 'My Story',
            description: description || '',
            thumbnail: null,
            seasons
        });
        
        res.json({ success: true, series });
    } catch (error) {
        console.error('Error creating series:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/series/:id - Update series
router.put('/series/:id', async (req, res) => {
    try {
        const { title, description, seasons } = req.body;
        const series = await Series.findById(req.params.id);
        
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        // Update basic info
        if (title) series.title = title;
        if (description !== undefined) series.description = description;
        
        // Update seasons if provided
        if (seasons && Array.isArray(seasons)) {
            seasons.forEach((seasonData, si) => {
                if (series.seasons[si]) {
                    if (seasonData.title !== undefined) series.seasons[si].title = seasonData.title;
                    if (seasonData.episodes && Array.isArray(seasonData.episodes)) {
                        seasonData.episodes.forEach((ep, ei) => {
                            if (series.seasons[si].episodes[ei]) {
                                if (ep.title !== undefined) series.seasons[si].episodes[ei].title = ep.title;
                                if (ep.description !== undefined) series.seasons[si].episodes[ei].description = ep.description;
                            }
                        });
                    }
                }
            });
        }
        
        await series.save();
        res.json({ success: true, series });
    } catch (error) {
        console.error('Error updating series:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/series/:id - Delete series
router.delete('/series/:id', async (req, res) => {
    try {
        const series = await Series.findById(req.params.id);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        // Delete all S3 files
        if (series.thumbnail) {
            const key = getKeyFromUrl(series.thumbnail);
            if (key) await deleteFromS3(key);
        }
        
        for (const season of series.seasons) {
            await deleteSeasonAssets(season);
        }
        
        await Series.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting series:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SEASON ROUTES
// ============================================

// POST /api/series/:seriesId/seasons - Add a new season
router.post('/series/:seriesId/seasons', async (req, res) => {
    try {
        const { episodeCount } = req.body;
        const numEpisodes = Math.min(Math.max(episodeCount || 1, 1), 10);
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        if (series.seasons.length >= 10) {
            return res.status(400).json({ error: 'Maximum 10 seasons allowed' });
        }
        
        const seasonNumber = series.seasons.length + 1;
        series.seasons.push({
            title: `Season ${seasonNumber}`,
            episodes: Array.from({ length: numEpisodes }, (_, i) => ({
                title: `Episode ${i + 1}`,
                thumbnail: null,
                description: '',
                music: null,
                musicOriginalName: null,
                media: []
            }))
        });
        
        await series.save();
        res.json({ success: true, series });
    } catch (error) {
        console.error('Error adding season:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/series/:seriesId/seasons/:seasonIndex - Remove a season
router.delete('/series/:seriesId/seasons/:seasonIndex', async (req, res) => {
    try {
        const seasonIndex = parseInt(req.params.seasonIndex);
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        if (seasonIndex >= series.seasons.length) {
            return res.status(400).json({ error: 'Invalid season index' });
        }
        
        if (series.seasons.length <= 1) {
            return res.status(400).json({ error: 'Cannot delete the last season' });
        }
        
        // Delete all S3 assets for the season
        await deleteSeasonAssets(series.seasons[seasonIndex]);
        
        series.seasons.splice(seasonIndex, 1);
        await series.save();
        
        res.json({ success: true, series });
    } catch (error) {
        console.error('Error deleting season:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/series/:seriesId/seasons/:seasonIndex/episodes - Add episode to season
router.post('/series/:seriesId/seasons/:seasonIndex/episodes', async (req, res) => {
    try {
        const seasonIndex = parseInt(req.params.seasonIndex);
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        if (seasonIndex >= series.seasons.length) {
            return res.status(400).json({ error: 'Invalid season index' });
        }
        
        const season = series.seasons[seasonIndex];
        if (season.episodes.length >= 10) {
            return res.status(400).json({ error: 'Maximum 10 episodes per season' });
        }
        
        season.episodes.push({
            title: `Episode ${season.episodes.length + 1}`,
            thumbnail: null,
            description: '',
            music: null,
            musicOriginalName: null,
            media: []
        });
        
        await series.save();
        res.json({ success: true, series });
    } catch (error) {
        console.error('Error adding episode:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/series/:seriesId/seasons/:seasonIndex/episodes/:episodeIndex - Remove episode
router.delete('/series/:seriesId/seasons/:seasonIndex/episodes/:episodeIndex', async (req, res) => {
    try {
        const seasonIndex = parseInt(req.params.seasonIndex);
        const episodeIndex = parseInt(req.params.episodeIndex);
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        if (seasonIndex >= series.seasons.length) {
            return res.status(400).json({ error: 'Invalid season index' });
        }
        
        const season = series.seasons[seasonIndex];
        if (episodeIndex >= season.episodes.length) {
            return res.status(400).json({ error: 'Invalid episode index' });
        }
        
        if (season.episodes.length <= 1) {
            return res.status(400).json({ error: 'Cannot delete the last episode in a season' });
        }
        
        // Delete all S3 assets for the episode
        await deleteEpisodeAssets(season.episodes[episodeIndex]);
        
        season.episodes.splice(episodeIndex, 1);
        await series.save();
        
        res.json({ success: true, series });
    } catch (error) {
        console.error('Error deleting episode:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// UPLOAD ROUTES
// ============================================

// POST /api/series/:seriesId/upload/thumbnail - Upload series thumbnail
router.post('/series/:seriesId/upload/thumbnail', uploadSeriesThumbnail.single('thumbnail'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        // Delete old thumbnail from S3 if exists
        if (series.thumbnail) {
            const oldKey = getKeyFromUrl(series.thumbnail);
            if (oldKey) await deleteFromS3(oldKey);
        }
        
        const s3Url = getS3Url(req.file.key);
        series.thumbnail = s3Url;
        await series.save();
        
        console.log(`[API] ✅ Series thumbnail uploaded successfully`);
        console.log(`[API]    S3 URL: ${s3Url}`);
        
        res.json({ success: true, filename: req.file.key, url: s3Url });
    } catch (error) {
        console.error('Error uploading series thumbnail:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/series/:seriesId/upload/thumbnail/:seasonIndex/:episodeIndex - Upload episode thumbnail
router.post('/series/:seriesId/upload/thumbnail/:seasonIndex/:episodeIndex', uploadThumbnail.single('thumbnail'), async (req, res) => {
    try {
        const seasonIndex = parseInt(req.params.seasonIndex);
        const episodeIndex = parseInt(req.params.episodeIndex);
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        const episode = getEpisode(series, seasonIndex, episodeIndex);
        if (!episode) {
            return res.status(400).json({ error: 'Invalid season or episode index' });
        }
        
        // Delete old thumbnail from S3 if exists
        if (episode.thumbnail) {
            const oldKey = getKeyFromUrl(episode.thumbnail);
            if (oldKey) await deleteFromS3(oldKey);
        }
        
        const s3Url = getS3Url(req.file.key);
        episode.thumbnail = s3Url;
        await series.save();
        
        console.log(`[API] ✅ Season ${seasonIndex} Episode ${episodeIndex} thumbnail uploaded successfully`);
        console.log(`[API]    S3 URL: ${s3Url}`);
        
        res.json({ success: true, filename: req.file.key, url: s3Url });
    } catch (error) {
        console.error('Error uploading episode thumbnail:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/series/:seriesId/upload/media/:seasonIndex/:episodeIndex - Upload episode media files
router.post('/series/:seriesId/upload/media/:seasonIndex/:episodeIndex', uploadMedia.array('media', 50), async (req, res) => {
    try {
        const seasonIndex = parseInt(req.params.seasonIndex);
        const episodeIndex = parseInt(req.params.episodeIndex);
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        const episode = getEpisode(series, seasonIndex, episodeIndex);
        if (!episode) {
            return res.status(400).json({ error: 'Invalid season or episode index' });
        }
        
        const newMedia = req.files.map(file => {
            const isVideo = /mp4|webm|mov|avi|mkv/.test(path.extname(file.originalname).toLowerCase());
            const s3Url = getS3Url(file.key);
            return {
                filename: file.key,
                originalName: file.originalname,
                type: isVideo ? 'video' : 'image',
                url: s3Url
            };
        });
        
        episode.media.push(...newMedia);
        await series.save();
        
        console.log(`[API] ✅ ${newMedia.length} media file(s) uploaded to S${seasonIndex}E${episodeIndex}`);
        newMedia.forEach(m => console.log(`[API]    - ${m.type}: ${m.url}`));
        
        res.json({ success: true, files: newMedia });
    } catch (error) {
        console.error('Error uploading media:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/series/:seriesId/upload/music/:seasonIndex/:episodeIndex - Upload episode music
router.post('/series/:seriesId/upload/music/:seasonIndex/:episodeIndex', uploadMusic.single('music'), async (req, res) => {
    try {
        const seasonIndex = parseInt(req.params.seasonIndex);
        const episodeIndex = parseInt(req.params.episodeIndex);
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        const episode = getEpisode(series, seasonIndex, episodeIndex);
        if (!episode) {
            return res.status(400).json({ error: 'Invalid season or episode index' });
        }
        
        // Delete old music from S3 if exists
        if (episode.music) {
            const oldKey = getKeyFromUrl(episode.music);
            if (oldKey) await deleteFromS3(oldKey);
        }
        
        const s3Url = getS3Url(req.file.key);
        episode.music = s3Url;
        episode.musicOriginalName = req.file.originalname;
        await series.save();
        
        console.log(`[API] ✅ Music uploaded to S${seasonIndex}E${episodeIndex}`);
        console.log(`[API]    Original: ${req.file.originalname}`);
        console.log(`[API]    S3 URL: ${s3Url}`);
        
        res.json({
            success: true,
            filename: req.file.key,
            originalName: req.file.originalname,
            url: s3Url
        });
    } catch (error) {
        console.error('Error uploading music:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// DELETE ROUTES
// ============================================

// DELETE /api/series/:seriesId/music/:seasonIndex/:episodeIndex - Delete episode music
router.delete('/series/:seriesId/music/:seasonIndex/:episodeIndex', async (req, res) => {
    try {
        const seasonIndex = parseInt(req.params.seasonIndex);
        const episodeIndex = parseInt(req.params.episodeIndex);
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        const episode = getEpisode(series, seasonIndex, episodeIndex);
        if (!episode) {
            return res.status(400).json({ error: 'Invalid season or episode index' });
        }
        
        if (episode.music) {
            const key = getKeyFromUrl(episode.music);
            if (key) await deleteFromS3(key);
        }
        
        episode.music = null;
        episode.musicOriginalName = null;
        await series.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting music:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/series/:seriesId/media/:seasonIndex/:episodeIndex/:mediaId - Delete media from episode
router.delete('/series/:seriesId/media/:seasonIndex/:episodeIndex/:mediaId', async (req, res) => {
    try {
        const seasonIndex = parseInt(req.params.seasonIndex);
        const episodeIndex = parseInt(req.params.episodeIndex);
        const mediaId = req.params.mediaId;
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        const episode = getEpisode(series, seasonIndex, episodeIndex);
        if (!episode) {
            return res.status(400).json({ error: 'Invalid season or episode index' });
        }
        
        const mediaIndex = episode.media.findIndex(m => m._id.toString() === mediaId);
        
        if (mediaIndex === -1) {
            return res.status(404).json({ error: 'Media not found' });
        }
        
        const media = episode.media[mediaIndex];
        const key = getKeyFromUrl(media.url);
        if (key) await deleteFromS3(key);
        
        episode.media.splice(mediaIndex, 1);
        await series.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting media:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/series/:seriesId/reorder/:seasonIndex/:episodeIndex - Reorder media
router.put('/series/:seriesId/reorder/:seasonIndex/:episodeIndex', async (req, res) => {
    try {
        const seasonIndex = parseInt(req.params.seasonIndex);
        const episodeIndex = parseInt(req.params.episodeIndex);
        const { mediaIds } = req.body;
        
        const series = await Series.findById(req.params.seriesId);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        
        const episode = getEpisode(series, seasonIndex, episodeIndex);
        if (!episode) {
            return res.status(400).json({ error: 'Invalid season or episode index' });
        }
        
        const reorderedMedia = mediaIds.map(id => 
            episode.media.find(m => m._id.toString() === id)
        ).filter(Boolean);
        
        episode.media = reorderedMedia;
        await series.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error reordering media:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
