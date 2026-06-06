const crypto = require('crypto');

function buildUid(openid) {
    // Keep uid deterministic so stateless deployments can restore the same player identity.
    return crypto.createHash('sha256').update(String(openid)).digest('hex').slice(0, 24);
}

async function initDb() {
    return {
        async getUserByOpenid(openid) {
            if (!openid) {
                return null;
            }

            return {
                id: buildUid(openid),
                wx_openid: String(openid),
            };
        },

        async getUserById(id) {
            if (!id) {
                return null;
            }

            return {
                id: String(id),
                wx_openid: '',
            };
        },

        async createUser(payload) {
            return {
                id: buildUid(payload.wx_openid),
                wx_openid: String(payload.wx_openid),
                wx_unionid: payload.wx_unionid || null,
                nickname: payload.nickname || null,
                avatar_url: payload.avatar_url || null,
                created_at: payload.created_at,
                updated_at: payload.updated_at,
            };
        },

        async updateUser(id, patch) {
            return {
                id: String(id),
                ...patch,
            };
        },
    };
}

module.exports = {
    initDb,
    buildUid,
};
