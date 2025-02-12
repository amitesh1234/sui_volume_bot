"use strict";
const models = require("../models");

const createSBD = async data => JSON.parse(JSON.stringify(await models.sol_bot_details.create(data)));
const updateSBD = async (query, data) => await models.sol_bot_details.update(data, { where: query, logging: console.log });

const createData = async (data, modelName) => JSON.parse(JSON.stringify(await models[modelName].create(data)));
const getSingleData = async (query, modelName) => JSON.parse(JSON.stringify(await models[modelName].findOne({ where: query })));
const updateData = async (data, query, modelName) => await models[modelName].update(data, { where: query, logging: console.log });
const getData = async (query, modelName, attributes) => JSON.parse(JSON.stringify(await models[modelName].findAll({ where: query, attributes: attributes })));


module.exports = {
    createSBD,
    updateSBD,
    createData,
    getSingleData,
    updateData,
    getData
}



