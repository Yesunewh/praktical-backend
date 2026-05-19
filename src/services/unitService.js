const { UnitType, OrganizationalUnit, Department } = require("../models");

class UnitService {
  // --- UNIT TYPES (LEVELS) ---
  async createUnitType(orgId, data) {
    // Hard restriction implemented at the model level, but checked here for safe error forwarding
    if (data.level > 5 || data.level < 1) {
      throw new Error("Unit levels must be between 1 and 5.");
    }

    if (data.level > 1) {
      const previousLevel = await UnitType.findOne({ where: { level: data.level - 1, org_id: orgId } });
      if (!previousLevel) {
        throw new Error(`You must define Level ${data.level - 1} before you can define Level ${data.level}.`);
      }
    }

    const existingName = await UnitType.findOne({ where: { name: data.name, org_id: orgId } });
    if (existingName) {
      throw new Error(`A unit type with the name '${data.name}' already exists.`);
    }

    const existingLevel = await UnitType.findOne({ where: { level: data.level, org_id: orgId } });
    if (existingLevel) {
      throw new Error(`A unit type for level ${data.level} already exists.`);
    }

    return await UnitType.create({ ...data, org_id: orgId });
  }

  async getUnitTypes(orgId) {
    return await UnitType.findAll({
      where: { org_id: orgId },
      order: [["level", "ASC"]],
    });
  }

  async deleteUnitType(id) {
    return await UnitType.destroy({ where: { id } });
  }

  async updateUnitType(id, orgId, data) {
    const type = await UnitType.findOne({ where: { id, org_id: orgId } });
    if (!type) throw new Error("Unit type not found or access denied.");
    return await type.update(data);
  }

  // --- ORGANIZATIONAL UNITS (ACTUAL BRANCHES/OFFICES) ---
  async createUnit(orgId, data) {
    const type = await UnitType.findOne({
      where: { id: data.type_id, org_id: orgId },
    });
    if (!type) throw new Error("Invalid Unit Type. Please define levels first.");

    if (data.parent_id) {
      const parent = await OrganizationalUnit.findOne({
        where: { id: data.parent_id, org_id: orgId },
      });
      if (!parent) throw new Error("Invalid Parent Unit ID.");
    }

    return await OrganizationalUnit.create({ ...data, org_id: orgId });
  }

  _findNodeInForest(nodes, unitId) {
    for (const n of nodes || []) {
      if (String(n.id) === String(unitId)) return n;
      const found = this._findNodeInForest(n.SubUnits || [], unitId);
      if (found) return found;
    }
    return null;
  }

  /**
   * For UNIT_ADMIN: return a one-root tree (that node and descendants only).
   */
  treeScopedToUnit(fullTree, unitId) {
    if (!unitId) return fullTree;
    const node = this._findNodeInForest(fullTree, unitId);
    return node ? [node] : [];
  }

  /**
   * Recursively get all IDs in a subtree.
   */
  async getSubtreeIds(rootId, orgId) {
    if (!rootId) return [];
    const results = [rootId];
    const children = await OrganizationalUnit.findAll({
      where: { parent_id: rootId, org_id: orgId, status: "ACTIVE" },
      attributes: ["id"],
    });
    for (const child of children) {
      const subIds = await this.getSubtreeIds(child.id, orgId);
      results.push(...subIds);
    }
    return results;
  }

  async isDescendantOf(childId, parentId, orgId) {
    if (!childId || !parentId) return false;
    let currentId = childId;
    // Safety limit to prevent infinite loops, though levels are capped at 5
    let iterations = 0;
    while (currentId && iterations < 10) {
      if (String(currentId) === String(parentId)) return true;
      const unit = await OrganizationalUnit.findOne({
        where: { id: currentId, org_id: orgId },
        attributes: ["parent_id"],
      });
      if (!unit) break;
      currentId = unit.parent_id;
      iterations++;
    }
    return false;
  }

  /**
   * Enforce who may create which structural level (org-wide vs. under assigned branch only).
   */
  async assertActorMayCreateUnit(actor, orgId, data) {
    const {
      SUPER_ADMIN_BASELINE_ROLE_NAME,
      ORG_ADMIN_BASELINE_ROLE_NAME,
      BRANCH_UNIT_BASELINE_ROLE_NAME,
    } = require("../config/systemBaselineRoles");

    const actorRoleName = actor.role?.name;
    const isSuperAdmin = actor.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

    if (isSuperAdmin || actor.isSuperAdmin) return;

    const newType = await UnitType.findOne({
      where: { id: data.type_id, org_id: orgId },
    });
    if (!newType) {
      const err = new Error("Invalid Unit Type. Please define levels first.");
      throw err;
    }

    if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
      // Org admins can only create top-level locations
      if (data.parent_id) {
        const err = new Error("Organization admins may only create top-level locations. Sub-locations must be added by their respective branch admin.");
        err.statusCode = 403;
        throw err;
      }
      if (newType.level !== 1) {
        const err = new Error("Top-level locations must use your organization's level-1 terminology.");
        err.statusCode = 403;
        throw err;
      }
      return;
    }

    if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
      if (!actor.unit_id) {
        const err = new Error("Your account is not assigned to a branch.");
        err.statusCode = 403;
        throw err;
      }
      // Can ONLY create direct children
      if (String(data.parent_id || "") !== String(actor.unit_id)) {
        const err = new Error("You may only create sub-locations directly under your assigned branch (one level below).");
        err.statusCode = 403;
        throw err;
      }

      const parent = await OrganizationalUnit.findOne({
        where: { id: data.parent_id, org_id: orgId },
        include: [{ model: UnitType, as: "Type" }],
      });
      if (!parent) throw new Error("Invalid Parent Unit ID.");
      const parentLevel = parent.Type && parent.Type.level;
      if (parentLevel == null || newType.level !== parentLevel + 1) {
        throw new Error("You may only create the next structural level under your branch.");
      }
      return;
    }

    const err = new Error("Forbidden: You do not have the required administrative role.");
    err.statusCode = 403;
    throw err;
  }

  async getUnitsTree(orgId) {
    // Fetch all nodes
    const units = await OrganizationalUnit.findAll({
      where: { org_id: orgId, status: "ACTIVE" },
      include: [
        { model: UnitType, as: "Type" },
        { model: Department, as: "Departments" },
      ],
      order: [["createdAt", "ASC"]],
    });

    // We serialize into pure JSON for tree manipulation
    const unitsData = units.map(u => u.toJSON());

    // Build the tree
    const unitMap = new Map();
    const tree = [];

    unitsData.forEach((unit) => {
      unit.SubUnits = [];
      unitMap.set(unit.id, unit);
    });

    unitsData.forEach((unit) => {
      if (unit.parent_id) {
        const parent = unitMap.get(unit.parent_id);
        if (parent) {
          parent.SubUnits.push(unit);
        }
      } else {
        // Is root unit
        tree.push(unit);
      }
    });

    return tree;
  }

  /**
   * Tenant "org-level" branch: roots of the unit forest (parent_id null).
   * If multiple roots exist, the oldest by createdAt is used (deterministic).
   */
  async getOrgRootUnitId(orgId) {
    const { AppError } = require("../middlewares/errorMiddleware");
    if (!orgId) {
      throw new AppError("Organization context required", 400);
    }
    const root = await OrganizationalUnit.findOne({
      where: {
        org_id: orgId,
        status: "ACTIVE",
        parent_id: null,
      },
      order: [["createdAt", "ASC"]],
    });
    if (!root) {
      throw new AppError(
        "No organizational unit hierarchy exists yet. Add at least one top-level location in Hierarchy before adding users.",
        400,
      );
    }
    return root.id;
  }
  async updateUnit(id, orgId, data) {
    const unit = await OrganizationalUnit.findOne({ where: { id, org_id: orgId } });
    if (!unit) throw new Error("Unit not found or access denied.");
    return await unit.update(data);
  }

  async assertActorMayEditUnit(actor, unitId, orgId) {
    const {
      SUPER_ADMIN_BASELINE_ROLE_NAME,
      ORG_ADMIN_BASELINE_ROLE_NAME,
      BRANCH_UNIT_BASELINE_ROLE_NAME,
    } = require("../config/systemBaselineRoles");

    const actorRoleName = actor.role?.name;
    const isSuperAdmin = actor.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

    if (isSuperAdmin || actor.isSuperAdmin) return;

    const targetUnit = await OrganizationalUnit.findOne({
      where: { id: unitId, org_id: orgId },
      include: [{ model: UnitType, as: "Type" }],
    });
    if (!targetUnit) throw new Error("Unit not found or access denied.");

    if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
      // Org admins can only edit top-level (level 1) branches
      if (targetUnit.Type && targetUnit.Type.level === 1) return;
      throw new Error("Organization admins may only edit top-level branches. Sub-branches must be managed by their parent branch admin.");
    }

    if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
      // Can edit their own branch
      if (String(unitId) === String(actor.unit_id)) return;
      // Can edit direct children (one level below)
      if (String(targetUnit.parent_id) === String(actor.unit_id)) return;
      throw new Error("You may only edit your own branch or branches directly under yours.");
    }
    throw new Error("Access denied.");
  }
}

module.exports = new UnitService();
