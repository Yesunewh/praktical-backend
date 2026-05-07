const AdministrativeUnit = require("../models/administrativeUnitModel");

/**
 * Recursively find the Health Center associated with a unit (e.g. searching up from a Block)
 * @param {string} unitId - The ID of the starting administrative unit
 * @returns {string|null} - The ID of the Health Center, or null if not found
 */
const findHealthCenterId = async (unitId) => {
    let currentUnit = await AdministrativeUnit.findByPk(unitId);

    while (currentUnit) {
        if (currentUnit.level === "HEALTH_CENTER") {
            return currentUnit.id;
        }

        if (!currentUnit.parent_id) break;

        currentUnit = await AdministrativeUnit.findByPk(currentUnit.parent_id);
    }

    return null;
};

module.exports = {
    findHealthCenterId
};
