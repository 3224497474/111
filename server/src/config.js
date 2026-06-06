const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const rootDir = path.resolve(__dirname, '..');

module.exports = {
    port: Number(process.env.PORT || 8080),
    wechatAppId: process.env.WX_APPID || '',
    wechatSecret: process.env.WX_SECRET || '',
    jwtSecret: process.env.JWT_SECRET || 'replace_me_with_a_real_secret',
    tokenExpiresIn: process.env.TOKEN_EXPIRES_IN || '30d',
    dbFile: path.resolve(rootDir, process.env.DB_FILE || process.env.DATA_FILE || './data/auth.json'),
};
