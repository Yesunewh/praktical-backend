const {
    createGroupService,
    listGroupsService,
    updateGroupService,
    deleteGroupService,
    assignUserToGroupService,
    updateUserInGroupService,
    getGroupProfessionalsService,
} = require("../services/groupService");

const createGroupController = async (req, res, next) => {
    try {
        const { name, specialization } = req.body;
        const newGroup = await createGroupService(name, specialization, req.user);
        res.status(201).json({ success: true, message: req.t ? req.t("success.group_created") : "Group created", data: newGroup });
    } catch (error) {
        next(error);
    }
};

const listGroupsController = async (req, res, next) => {
    try {
        const groups = await listGroupsService(req.user);
        res.status(200).json({ success: true, data: groups });
    } catch (error) {
        next(error);
    }
};

const updateGroupController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, specialization } = req.body;
        const group = await updateGroupService(id, name, specialization, req.user);
        res.status(200).json({ success: true, message: req.t ? req.t("success.group_updated") : "Group updated", data: group });
    } catch (error) {
        next(error);
    }
};

const deleteGroupController = async (req, res, next) => {
    try {
        const { id } = req.params;
        await deleteGroupService(id, req.user);
        res.status(200).json({ success: true, message: req.t ? req.t("success.group_deleted") : "Group deleted" });
    } catch (error) {
        next(error);
    }
};

const assignGroupUserController = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { user_id, role, permissions } = req.body;
        const assignment = await assignUserToGroupService(groupId, user_id, role, permissions, req.user);
        res.status(201).json({ success: true, message: req.t ? req.t("success.group_user_assigned") : "Group User Assigned", data: assignment });
    } catch (error) {
        next(error);
    }
};

const updateGroupUserController = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { user_id, role, permissions } = req.body;
        const result = await updateUserInGroupService(groupId, user_id, role, permissions, req.user);
        res.status(200).json({ success: true, message: req.t ? req.t("success.group_user_updated") : "Group User Updated", data: result });
    } catch (error) {
        next(error);
    }
};

const getGroupProfessionalsController = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const professionals = await getGroupProfessionalsService(groupId);
        res.status(200).json({ success: true, data: professionals });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createGroupController,
    listGroupsController,
    updateGroupController,
    deleteGroupController,
    assignGroupUserController,
    updateGroupUserController,
    getGroupProfessionalsController,
};
