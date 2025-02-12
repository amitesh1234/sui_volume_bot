"use strict";
const models = require("../models");

const createSBD = async data => await models.sol_bot_details.create(data);
const updateSBD = async (query, data) => await models.sol_bot_details.update(data, { where: query, logging: console.log });

const createData = async (data, modelName) => JSON.parse(JSON.stringify(await models[modelName].create(data)));
const getSingleData = async (query, modelName) => JSON.parse(JSON.stringify(await models[modelName].findOne({ where: query })));
const updateData = async (query, data, modelName) => await models[modelName].update(data, { where: query, logging: console.log });


module.exports = {
    createSBD,
    updateSBD,
    createData,
    getSingleData,
    updateData
}



