/**
 * MongoDB Database Connection
 */
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`\n✅ MongoDB Connected: ${conn.connection.host}\n`);
    } catch (error) {
        console.error('\n❌ MongoDB Connection Error:', error.message);
        console.error('Please check your MONGODB_URI in .env file\n');
        process.exit(1);
    }
};

module.exports = connectDB;
