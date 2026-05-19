const { 
  createOrganizationService, 
  getAllOrgsService, 
  getOrgByIdService 
} = require("../services/orgService");

const createOrganizationController = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      // In this system, we store the filename or a relative path
      data.logo_url = `/uploads/${req.file.filename}`;
    }

    const org = await createOrganizationService(data);
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
    const { id } = req.params;
    const actor = req.user;

    // Security Check: If not SuperAdmin, you can ONLY view your own Org
    if (!actor.isSuperAdmin && String(actor.org_id) !== String(id)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access Denied: You can only view your own organization details." 
      });
    }

    const org = await getOrgByIdService(id);
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
