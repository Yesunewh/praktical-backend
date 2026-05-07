// controllers/city.controller.js
const { unassignUser } = require("../services/assignnmentService");
const {
  listPublicCitiesService,
  createCityService,
  listCitiesService,
  updateCityService,
  deleteCityService,
  assignCityAdminService,
  createEthiopiaLevelUserService,
  updateEthiopiaLevelUserService,
  updateUserPermissions,
  getAllPermissionsService,
  getAllRolesService,
  getUnitPersonnelDetailsService,
  getPersonnelByRoleService } = require("../services/cityService");



const createCityController = async (req, res, next) => {
  try {
    const { name } = req.body;

    // Call the service
    const newCity = await createCityService(name, req.user);

    res.status(201).json({
      success: true,
      message: req.t("success.city_created"),
      city: newCity,
    });
  } catch (error) {
    next(error);
  }
};

const listPublicCitiesController = async (req, res, next) => {
  try {
    const cities = await listPublicCitiesService();
    res.status(200).json({ success: true, data: cities });
  } catch (error) {
    next(error);
  }
};

const listCitiesController = async (req, res, next) => {
  try {
    const cities = await listCitiesService();

    res.status(200).json({
      success: true,
      cities,
    });
  } catch (error) {
    next(error);
  }
};

const updateCityController = async (req, res, next) => {
  try {
    const { name } = req.body;
    const { id } = req.params;



    const updatedCity = await updateCityService(id, name);

    res.status(200).json({
      success: true,
      message: req.t("success.city_updated"),
      city: updatedCity,
    });
  } catch (error) {
    next(error);
  }
};

const deleteCityController = async (req, res, next) => {
  try {
    const { id } = req.params;

    await deleteCityService(id, req.user);

    res.status(200).json({
      success: true,
      message: req.t("success.city_deleted"),
    });
  } catch (error) {
    next(error);
  }
};


const assignCityAdminController = async (req, res, next) => {
  try {
    const { userId, cityId, permissions } = req.body;

    const assignment = await assignCityAdminService({
      userId,
      cityId,
      permissions,   // OPTIONAL
      currentUser: req.user,
    });

    res.status(201).json({
      success: true,
      message: req.t("success.city_admin_assigned"),
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

const createEthiopiaLevelUserController = async (req, res, next) => {
  try {
    const { user_id, role, permissions } = req.body;

    const result = await createEthiopiaLevelUserService({
      userId: user_id,
      roleName: role,
      permissions,
      actor: req.user,
    });

    res.status(200).json({
      success: true,
      message: req.t("success.user_assigned_ethiopia"),
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const unassignUserController = async (req, res, next) => {
  try {
    const { userId } = req.body;

    console.log(req.user)

    const result = await unassignUser({
      targetUserId: userId,
      performedBy: req.user,
    });

    res.status(200).json({
      success: true,
      message: req.t(result.message),
    });
  } catch (error) {
    next(error);
  }
};

const updateUserPermissionsController = async (req, res, next) => {
  try {
    const { userId, permissions } = req.body;

    const result = await updateUserPermissions({
      targetUserId: userId,
      permissions,
    });

    res.status(200).json({
      success: true,
      message: req.t("success.user_permissions_updated"),
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const updateEthiopiaLevelUserController = async (req, res, next) => {
  try {
    const { user_id, role, permissions } = req.body;

    const result = await updateEthiopiaLevelUserService({
      userId: user_id,
      roleName: role,
      permissions,
      actor: req.user,
    });

    res.status(200).json({
      success: true,
      message: req.t("success.user_role_permissions_updated"),
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getAllPermissionsController = async (req, res, next) => {
  try {
    const permissions = await getAllPermissionsService();

    res.status(200).json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    next(error);
  }
};


const getAllRolesController = async (req, res, next) => {
  try {
    const roles = await getAllRolesService();

    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};



const getPersonnelByRoleController = async (req, res, next) => {
  try {
    const { role } = req.query; // Allow choosing role, or default to GROUP_LEADER
    const roleName = role || "GROUP_LEADER";

    // Extract unit_id from the authenticated user's token
    const unitId = req.user.unit.id;

    const personnel = await getPersonnelByRoleService({
      unitId,
      roleName: roleName
    });

    res.status(200).json({
      success: true,
      data: personnel,
    });
  } catch (error) {
    next(error);
  }
};


const getUnitPersonnelDetailsController = async (req, res, next) => {
  try {
    const unitId = req.user.unit.id;
    const currentUserId = req.user.id;

    const personnel = await getUnitPersonnelDetailsService(unitId, currentUserId);

    res.status(200).json({
      success: true,
      data: personnel,
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  listPublicCitiesController,
  createCityController,
  listCitiesController,
  updateCityController,
  deleteCityController, // Unit delete
  assignCityAdminController,
  createEthiopiaLevelUserController,
  unassignUserController,
  updateUserPermissionsController,
  updateEthiopiaLevelUserController,
  getAllPermissionsController,
  getAllRolesController,
  getPersonnelByRoleController,
  getUnitPersonnelDetailsController,

};
