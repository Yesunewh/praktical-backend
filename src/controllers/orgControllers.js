const { 
  createOrganizationService, 
  getAllOrgsService, 
  getOrgByIdService 
} = require("../services/orgService");

const createOrganizationController = async (req, res, next) => {
  try {
    const org = await createOrganizationService(req.body);
    res.status(201).json({
      success: true,
      message: req.t ? req.t("success.org_created") : "Organization created successfully",
      org,
    });
  } catch (error) {
    next(error);
  }
};

const getAllOrgsController = async (req, res, next) => {
  try {
    const orgs = await getAllOrgsService();
    res.status(200).json({
      success: true,
      orgs,
    });
  } catch (error) {
    next(error);
  }
};

const getOrgByIdController = async (req, res, next) => {
  try {
    const org = await getOrgByIdService(req.params.id);
    res.status(200).json({
      success: true,
      org,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrganizationController,
  getAllOrgsController,
  getOrgByIdController
};
