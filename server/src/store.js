const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const ACTIONS_FILE = path.join(DATA_DIR, 'processed-actions.json');

function ensureDataDir() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(filePath, fallback) {
    ensureDataDir();
    if (!fs.existsSync(filePath)) {
        return clone(fallback);
    }

    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return raw ? JSON.parse(raw) : clone(fallback);
    } catch (error) {
        console.warn(`[store] Failed to read ${filePath}:`, error);
        return clone(fallback);
    }
}

function writeJson(filePath, data) {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function loadPlayers() {
    return readJson(PLAYERS_FILE, {});
}

function savePlayers(players) {
    writeJson(PLAYERS_FILE, players);
}

function loadProcessedActions() {
    return readJson(ACTIONS_FILE, []);
}

function saveProcessedActions(actionIds) {
    writeJson(ACTIONS_FILE, actionIds);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

module.exports = {
    loadPlayers,
    savePlayers,
    loadProcessedActions,
    saveProcessedActions,
};
