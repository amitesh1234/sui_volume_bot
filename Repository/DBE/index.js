"use strict";
const models = require("../models");

const createSBD = async data => models.sol_bot_details.create(data);
const updateSBD = async (query, data) => await models.sol_bot_details.update(data, { where: query, logging: console.log });

module.exports = {
    createSBD,
    updateSBD
}



