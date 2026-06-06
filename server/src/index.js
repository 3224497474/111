const http = require('http');
const { loadPlayers, savePlayers, loadProcessedActions, saveProcessedActions } = require('./store');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 8080);
const DEFAULT_GOLD = 10000;

function createDefaultPlayerState(playerId) {
    return {
        playerId,
        economy: {
            currency: {
                balances: {
                    gold: DEFAULT_GOLD,
                    diamond: 0,
                    stamina: 0,
                    exp: 0,
                },
                dailyGained: {},
            },
            inventory: [],
            shop: {
                stocks: {},
                dailyBought: {},
                lastRefreshTime: {},
            },
            timestamp: Date.now(),
        },
    };
}

function getPlayerState(players, playerId) {
    if (!players[playerId]) {
        players[playerId] = createDefaultPlayerState(playerId);
    }
    return players[playerId];
}

function parsePlayerId(actionId) {
    if (typeof actionId !== 'string' || !actionId.trim()) {
        return 'anonymous';
    }

    const separatorIndex = actionId.indexOf('-');
    if (separatorIndex <= 0) {
        return actionId.trim();
    }

    return actionId.slice(0, separatorIndex).trim() || 'anonymous';
}

function getBalance(playerState, currencyKey) {
    return Number(playerState.economy?.currency?.balances?.[currencyKey] ?? 0);
}

function setBalance(playerState, currencyKey, amount) {
    playerState.economy.currency.balances[currencyKey] = Math.max(0, Math.floor(amount));
    playerState.economy.timestamp = Date.now();
}

function addInventoryItem(playerState, itemId, count) {
    const normalizedCount = Math.max(0, Math.floor(Number(count) || 0));
    if (!itemId || normalizedCount <= 0) {
        return;
    }

    const inventory = playerState.economy.inventory;
    const existing = inventory.find((item) => item.itemId === itemId);
    if (existing) {
        existing.count += normalizedCount;
    } else {
        inventory.push({
            itemId,
            count: normalizedCount,
        });
    }
    playerState.economy.timestamp = Date.now();
}

function recordShopPurchase(playerState, shopId, goodsId, count) {
    if (!shopId || !goodsId) {
        return;
    }

    const normalizedCount = Math.max(0, Math.floor(Number(count) || 0));
    if (normalizedCount <= 0) {
        return;
    }

    const dailyBought = playerState.economy.shop.dailyBought;
    if (!dailyBought[shopId]) {
        dailyBought[shopId] = {};
    }

    dailyBought[shopId][goodsId] = Number(dailyBought[shopId][goodsId] ?? 0) + normalizedCount;
    playerState.economy.shop.lastRefreshTime[shopId] = Date.now();
    playerState.economy.timestamp = Date.now();
}

function createSnapshot(playerState) {
    return {
        version: 1,
        updatedAt: Date.now(),
        modules: {
            economy: playerState.economy,
        },
    };
}

function rejectDesync(res, playerState, message) {
    writeJson(res, 403, {
        acceptedIds: [],
        rejected: [],
        message,
        snapshot: createSnapshot(playerState),
    });
}

function validateAction(action) {
    if (!action || typeof action !== 'object') {
        return 'Action must be an object.';
    }
    if (typeof action.actionId !== 'string' || !action.actionId.trim()) {
        return 'actionId is required.';
    }
    if (typeof action.actionType !== 'string' || !action.actionType.trim()) {
        return 'actionType is required.';
    }
    return null;
}

function applyBuyItem(playerState, action) {
    const payload = action.payload && typeof action.payload === 'object'
        ? action.payload
        : {};
    const goodsId = String(payload.goodsId ?? '').trim();
    const shopId = String(payload.shopId ?? '').trim();
    const count = Math.max(0, Math.floor(Number(payload.count) || 0));
    const totalPrice = Math.max(0, Math.floor(Number(payload.totalPrice) || 0));

    if (!goodsId || count <= 0) {
        return {
            ok: false,
            code: 400,
            message: 'Invalid buy_item payload.',
        };
    }

    const currentGold = getBalance(playerState, 'gold');
    if (currentGold < totalPrice) {
        return {
            ok: false,
            code: 403,
            message: `Gold mismatch. current=${currentGold}, required=${totalPrice}.`,
        };
    }

    setBalance(playerState, 'gold', currentGold - totalPrice);
    addInventoryItem(playerState, goodsId, count);
    recordShopPurchase(playerState, shopId, goodsId, count);
    return { ok: true };
}

function applyAction(playerState, action) {
    switch (action.actionType) {
        case 'buy_item':
            return applyBuyItem(playerState, action);
        case 'debug_ping':
            return { ok: true };
        default:
            return {
                ok: false,
                code: 400,
                message: `Unsupported actionType: ${action.actionType}`,
            };
    }
}

function handleSync(body, res) {
    if (!body || typeof body !== 'object' || !Array.isArray(body.actions)) {
        writeJson(res, 400, {
            acceptedIds: [],
            rejected: [],
            message: 'actions array is required.',
        });
        return;
    }

    const players = loadPlayers();
    const processedActions = new Set(loadProcessedActions());
    const acceptedIds = [];
    const rejected = [];

    for (const action of body.actions) {
        const validateError = validateAction(action);
        if (validateError) {
            rejected.push({
                actionId: String(action?.actionId ?? ''),
                reason: validateError,
            });
            continue;
        }

        if (processedActions.has(action.actionId)) {
            acceptedIds.push(action.actionId);
            continue;
        }

        const playerId = parsePlayerId(action.actionId);
        const playerState = getPlayerState(players, playerId);
        const result = applyAction(playerState, action);

        if (!result.ok && result.code === 403) {
            rejectDesync(res, playerState, result.message);
            return;
        }

        if (!result.ok) {
            rejected.push({
                actionId: action.actionId,
                reason: result.message,
            });
            continue;
        }

        processedActions.add(action.actionId);
        acceptedIds.push(action.actionId);
    }

    savePlayers(players);
    saveProcessedActions(Array.from(processedActions));

    writeJson(res, 200, {
        acceptedIds,
        rejected,
        snapshot: null,
        message: 'sync ok',
    });
}

function writeJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        writeJson(res, 200, { ok: true });
        return;
    }

    if (req.method === 'GET' && req.url === '/health') {
        writeJson(res, 200, {
            ok: true,
            service: 'network-v2-server',
            port: PORT,
            time: new Date().toISOString(),
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/sync') {
        try {
            const body = await parseJsonBody(req);
            handleSync(body, res);
        } catch (error) {
            writeJson(res, 400, {
                acceptedIds: [],
                rejected: [],
                message: `Invalid JSON body: ${error.message}`,
            });
        }
        return;
    }

    writeJson(res, 404, {
        ok: false,
        message: 'Not found',
    });
});

server.listen(PORT, HOST, () => {
    console.log(`[network-v2-server] listening on http://${HOST}:${PORT}`);
    console.log(`[network-v2-server] health: http://${HOST}:${PORT}/health`);
    console.log(`[network-v2-server] sync:   http://${HOST}:${PORT}/api/sync`);
});
