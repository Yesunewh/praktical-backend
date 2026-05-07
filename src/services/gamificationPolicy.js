const { Op } = require("sequelize");
const { AppError } = require("../middlewares/errorMiddleware");
const { Department, OrganizationalUnit } = require("../models");
const unitService = require("./unitService");

/**
 * Sequelize where fragment for challenges visible in list/play for this viewer.
 * Caller must merge with { is_active: true } and optional category/difficulty.
 */
async function buildChallengeVisibilityWhere(viewer, options = {}) {
  const { user_type: ut, org_id: uOrg, dept_id: uDept, unit_id: uUnit } = viewer || {};
  const filterOrgId = options.filterOrgId || null;
  const filterDeptId = options.filterDeptId || null;
  const filterUnitId = options.filterUnitId || null;

  if (ut === "SUPERADMIN") {
    const where = {};
    if (filterOrgId) where.org_id = filterOrgId;
    if (filterDeptId) where.dept_id = filterDeptId;
    if (filterUnitId) where.unit_id = filterUnitId;
    return where;
  }

  if (ut === "ORG_ADMIN") {
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
  const ut = user.user_type;
  if (ut === "SUPERADMIN") return true;

  const o = challenge.org_id;
  const d = challenge.dept_id;
  const u = challenge.unit_id;

  if (!o && !d && !u) return true; // Global

  if (ut === "ORG_ADMIN") {
    return o === user.org_id;
  }

  if (user.org_id && o !== user.org_id) return false;

  if (ut === "UNIT_ADMIN") {
    return u === user.unit_id || (!u && !d); // Own unit or org-wide within their org
  }

  if (ut === "DEPT_ADMIN") {
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
  const ut = author.user_type;
  const pOrg = payload.org_id != null ? payload.org_id : null;
  const pDept = payload.dept_id != null ? payload.dept_id : null;
  const pUnit = payload.unit_id != null ? payload.unit_id : null;

  await assertDepartmentMatchesOrg(pDept, pOrg);

  if (existingRow) {
    const isGlobal = !existingRow.org_id && !existingRow.dept_id && !existingRow.unit_id;
    if (isGlobal && ut !== "SUPERADMIN") {
      throw new AppError("Only SUPERADMIN can modify platform-wide challenges", 403);
    }
    if (ut !== "SUPERADMIN") {
      if (existingRow.org_id !== author.org_id) throw new AppError("Forbidden", 403);
      if (ut === "DEPT_ADMIN" && existingRow.dept_id && existingRow.dept_id !== author.dept_id) {
        throw new AppError("Forbidden", 403);
      }
      if (ut === "UNIT_ADMIN" && existingRow.unit_id && existingRow.unit_id !== author.unit_id) {
        throw new AppError("Forbidden", 403);
      }
    }
  }

  if (ut === "SUPERADMIN") return;

  if (ut === "ORG_ADMIN") {
    if (!pOrg && !pDept && !pUnit) throw new AppError("Only SUPERADMIN can create platform-wide challenges", 403);
    if (pOrg !== author.org_id) throw new AppError("Forbidden", 403);
    return;
  }

  if (ut === "UNIT_ADMIN") {
    if (pOrg !== author.org_id) throw new AppError("Forbidden", 403);
    const isDesc = await unitService.isDescendantOf(pUnit, author.unit_id, author.org_id);
    if (!isDesc) {
      throw new AppError("Branch admins may only publish to their own branch or its sub-branches", 403);
    }
    return;
  }

  if (ut === "DEPT_ADMIN") {
    if (pOrg !== author.org_id || pDept !== author.dept_id) {
      throw new AppError("Department admins may only publish to their own department", 403);
    }
    return;
  }

  throw new AppError("Forbidden", 403);
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
