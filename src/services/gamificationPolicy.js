const { Op } = require("sequelize");
const { AppError } = require("../middlewares/errorMiddleware");
const { Department, OrganizationalUnit } = require("../models");
const unitService = require("./unitService");

/**
 * Sequelize where fragment for challenges visible in list/play for this viewer.
 * Caller must merge with { is_active: true } and optional category/difficulty.
 */
const {
  ORG_ADMIN_BASELINE_ROLE_NAME,
  BRANCH_UNIT_BASELINE_ROLE_NAME,
  DEPT_ADMIN_BASELINE_ROLE_NAME,
  SUPER_ADMIN_BASELINE_ROLE_NAME,
} = require("../config/systemBaselineRoles");

/**
 * Sequelize where fragment for challenges visible in list/play for this viewer.
 * Caller must merge with { is_active: true } and optional category/difficulty.
 */
async function buildChallengeVisibilityWhere(viewer, options = {}) {
  const { org_id: uOrg, dept_id: uDept, unit_id: uUnit } = viewer || {};
  const actorRoleName = viewer?.role?.name;
  const isSuperAdmin = uOrg === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

  const filterOrgId = options.filterOrgId || null;
  const filterDeptId = options.filterDeptId || null;
  const filterUnitId = options.filterUnitId || null;

  if (isSuperAdmin) {
    const where = {};
    if (filterOrgId) where.org_id = filterOrgId;
    if (filterDeptId) where.dept_id = filterDeptId;
    if (filterUnitId) where.unit_id = filterUnitId;
    return where;
  }

  if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
    const where = {
      [Op.or]: [{ org_id: null, dept_id: null, unit_id: null }, { org_id: uOrg }],
    };
    if (filterDeptId) where.dept_id = filterDeptId;
    if (filterUnitId) where.unit_id = filterUnitId;
    return where;
  }

  if (!uOrg) {
    return { org_id: null, dept_id: null, unit_id: null };
  }

  const parts = [
    { org_id: null, dept_id: null, unit_id: null },
    { org_id: uOrg, dept_id: null, unit_id: null },
  ];
  
  if (uUnit) {
    // Show own unit OR any sub-unit
    const subUnits = await unitService.getSubtreeIds(uUnit, uOrg);
    parts.push({ org_id: uOrg, unit_id: { [Op.in]: subUnits } });
  }
  
  if (uDept) parts.push({ org_id: uOrg, dept_id: uDept });
  
  const where = { [Op.or]: parts };
  if (filterDeptId) where.dept_id = filterDeptId;
  if (filterUnitId) where.unit_id = filterUnitId;
  
  return where;
}

function userCanAccessChallenge(user, challenge) {
  if (!user || !challenge || challenge.is_active === false) return false;
  const actorRoleName = user?.role?.name;
  const isSuperAdmin = user.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

  if (isSuperAdmin) return true;

  const o = challenge.org_id;
  const d = challenge.dept_id;
  const u = challenge.unit_id;

  if (!o && !d && !u) return true; // Global

  if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
    return o === user.org_id;
  }

  if (user.org_id && o !== user.org_id) return false;

  if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
    return u === user.unit_id || (!u && !d); // Own unit or org-wide within their org
  }

  if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
    return d === user.dept_id || (!d && !u);
  }

  // Learner/Staff
  if (u) return user.unit_id === u;
  if (d) return user.dept_id === d;
  return o === user.org_id;
}

async function assertDepartmentMatchesOrg(deptId, orgId) {
  if (!deptId) return;
  if (!orgId) throw new AppError("org_id is required when dept_id is set", 400);
  const dep = await Department.findByPk(deptId);
  if (!dep) throw new AppError("Department not found", 400);
  if (dep.org_id !== orgId) throw new AppError("Department does not belong to organization", 400);
}

async function assertAuthorCanUpsertChallenge(author, payload, existingRow) {
  const actorRoleName = author?.role?.name;
  const isSuperAdmin = author.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;
  
  const pOrg = payload.org_id != null ? payload.org_id : null;
  const pDept = payload.dept_id != null ? payload.dept_id : null;
  const pUnit = payload.unit_id != null ? payload.unit_id : null;

  await assertDepartmentMatchesOrg(pDept, pOrg);

  if (existingRow) {
    const isGlobal = !existingRow.org_id && !existingRow.dept_id && !existingRow.unit_id;
    if (isGlobal && !isSuperAdmin) {
      throw new AppError("Only Super Admin can modify platform-wide challenges", 403);
    }
    if (!isSuperAdmin) {
      if (existingRow.org_id !== author.org_id) throw new AppError("Forbidden", 403);
      if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME && existingRow.dept_id && existingRow.dept_id !== author.dept_id) {
        throw new AppError("Forbidden", 403);
      }
      if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME && existingRow.unit_id && existingRow.unit_id !== author.unit_id) {
        throw new AppError("Forbidden", 403);
      }
    }
  }

  if (isSuperAdmin) return;

  if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
    if (!pOrg && !pDept && !pUnit) throw new AppError("Only Super Admin can create platform-wide challenges", 403);
    if (pOrg !== author.org_id) throw new AppError("Forbidden", 403);
    return;
  }

  if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
    if (pOrg !== author.org_id) throw new AppError("Forbidden", 403);
    const isDesc = await unitService.isDescendantOf(pUnit, author.unit_id, author.org_id);
    if (!isDesc) {
      throw new AppError("Branch admins may only publish to their own branch or its sub-branches", 403);
    }
    return;
  }

  if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
    if (pOrg !== author.org_id || pDept !== author.dept_id) {
      throw new AppError("Department admins may only publish to their own department", 403);
    }
    return;
  }

  throw new AppError("Forbidden: You do not have the required administrative role.", 403);
}

async function assertAuthorCanMutateExistingChallenge(author, row) {
  const fakePayload = { org_id: row.org_id, dept_id: row.dept_id, unit_id: row.unit_id };
  await assertAuthorCanUpsertChallenge(author, fakePayload, row);
}

module.exports = {
  buildChallengeVisibilityWhere,
  userCanAccessChallenge,
  assertDepartmentMatchesOrg,
  assertAuthorCanUpsertChallenge,
  assertAuthorCanMutateExistingChallenge,
};
