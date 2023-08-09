"use strict";
const redis = require("redis");
const memcached = require("memcached");
const util = require("util");

const KEY = `account1/balance`;
const DEFAULT_BALANCE = 100;
const MAX_EXPIRATION = 60 * 60 * 24 * 30;

// Initialize Redis client
const redisClient = redis.createClient({
    host: process.env.ENDPOINT,
    port: parseInt(process.env.PORT || "6379"),
});

// Initialize Memcached client
const memcachedClient = new memcached(`${process.env.ENDPOINT}:${process.env.PORT}`);

// Charge request using Redis
exports.chargeRequestRedis = async function (input) {
    try {
        const remainingBalance = await getBalanceRedis(redisClient, KEY);
        const charges = getCharges();
        const isAuthorized = authorizeRequest(remainingBalance, charges);

        if (!isAuthorized) {
            return {
                remainingBalance,
                isAuthorized,
                charges: 0,
            };
        }

        const updatedBalance = await chargeRedis(redisClient, KEY, charges);

        return {
            remainingBalance: updatedBalance,
            charges,
            isAuthorized,
        };
    } catch (error) {
        console.error("Error in chargeRequestRedis:", error);
        throw error;
    }
};

// Reset balance using Redis
exports.resetRedis = async function () {
    try {
        await setBalanceRedis(redisClient, KEY, DEFAULT_BALANCE);
        return DEFAULT_BALANCE;
    } catch (error) {
        console.error("Error in resetRedis:", error);
        throw error;
    }
};

// Charge request using Memcached
exports.chargeRequestMemcached = async function (input) {
    try {
        const remainingBalance = await getBalanceMemcached(KEY);
        const charges = getCharges();
        const isAuthorized = authorizeRequest(remainingBalance, charges);

        if (!isAuthorized) {
            return {
                remainingBalance,
                isAuthorized,
                charges: 0,
            };
        }

        const updatedBalance = await chargeMemcached(KEY, charges);

        return {
            remainingBalance: updatedBalance,
            charges,
            isAuthorized,
        };
    } catch (error) {
        console.error("Error in chargeRequestMemcached:", error);
        throw error;
    }
};

// Reset balance using Memcached
exports.resetMemcached = async function () {
    try {
        await setBalanceMemcached(memcachedClient, KEY, DEFAULT_BALANCE);
        return DEFAULT_BALANCE;
    } catch (error) {
        console.error("Error in resetMemcached:", error);
        throw error;
    }
};

// Helper function to authorize request
function authorizeRequest(remainingBalance, charges) {
    return remainingBalance >= charges;
}

// Helper function to calculate charges
function getCharges() {
    return DEFAULT_BALANCE / 20;
}

// Helper function to get balance from Redis
async function getBalanceRedis(redisClient, key) {
    const res = await util.promisify(redisClient.get).bind(redisClient).call(redisClient, key);
    return parseInt(res || "0");
}

// Helper function to set balance in Redis
async function setBalanceRedis(redisClient, key, balance) {
    await util.promisify(redisClient.set).bind(redisClient).call(redisClient, key, String(balance));
}

// Helper function to charge balance in Redis
async function chargeRedis(redisClient, key, charges) {
    return util.promisify(redisClient.decrby).bind(redisClient).call(redisClient, key, charges);
}

// Helper function to get balance from Memcached
async function getBalanceMemcached(key) {
    return new Promise((resolve, reject) => {
        memcachedClient.get(key, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(Number(data));
            }
        });
    });
}

// Helper function to set balance in Memcached
async function setBalanceMemcached(memcachedClient, key, balance) {
    return new Promise((resolve, reject) => {
        memcachedClient.set(key, balance, MAX_EXPIRATION, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

// Helper function to charge balance in Memcached
async function chargeMemcached(key, charges) {
    return new Promise((resolve, reject) => {
        memcachedClient.decr(key, charges, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(Number(result));
            }
        });
    });
}