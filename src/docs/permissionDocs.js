/**
 * @swagger
 * components:
 *   schemas:
 *     AvailablePermissionRow:
 *       type: object
 *       description: |
 *         Permission catalog row with access mask for the current user and org/branch context.
 *         `matrix_locked_for_editor` reflects the permission matrix: for **ORG_ADMIN**, **UNIT_ADMIN**, and **DEPT_ADMIN**,
 *         learner preview permissions `PLAY_CHALLENGES` and `VIEW_REMEDIATION` are marked locked so the tenant Role Management UI
 *         does not allow toggling them off (server also merges them on org role save).
 *         **Responses for platform administrators (Super Admin role) replace the mask:** `has_access` is true for every row and
 *         `matrix_locked_for_editor` is false (platform operator is not subject to tenant-editor locks).
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: PLAY_CHALLENGES
 *         description:
 *           type: string
 *           nullable: true
 *         module:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         has_access:
 *           type: boolean
 *           description: Whether this permission is granted to the org/unit context (after tier hidden rules). Not used as sole source for platform administrators.
 *         matrix_locked_for_editor:
 *           type: boolean
 *           description: When true, Role Management should keep the checkbox disabled for this row (preview perms for admin tiers).
 *     AvailablePermissionsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AvailablePermissionRow'
 *
 * /permissions:
 *   get:
 *     summary: Get all available permissions with user access mask and matrix lock hints
 *     description: |
 *       Returns the permission catalog merged with `has_access` for the caller's org (and optional unit path) and tier.
 *       Use `matrix_locked_for_editor` in admin Role Management to explain disabled checkboxes for tenant editors.
 *       **Super Admin** may pass `org_id` query to preview another tenant's pool; response rows use the Super Admin mask (all `has_access` true, locks off).
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: org_id
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant org to scope allocations (typically used by SUPERADMIN; tenant admins use JWT org).
 *     responses:
 *       200:
 *         description: List of permissions with `has_access` and optional `matrix_locked_for_editor`
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AvailablePermissionsResponse'
 *
 *   post:
 *     summary: Super Admin pushes a new fixed permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Fixed Permission created
 *
 * /permissions/{permissionId}/allocate:
 *   post:
 *     summary: Scoped allocation of permission to an Org or Branch
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [SYSTEM, ORGANIZATION, UNIT]
 *               targetId:
 *                 type: string
 *                 format: uuid
 *               effect:
 *                 type: string
 *                 enum: [GRANT, DENY]
 *     responses:
 *       201:
 *         description: Permission allocated or denied successfully
 *
 * /permissions/organizations/{orgId}/bulk:
 *   post:
 *     summary: Bulk allocate permissions to an Organization (Super Admin)
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - permissionId
 *                     - effect
 *                   properties:
 *                     permissionId:
 *                       type: string
 *                     effect:
 *                       type: string
 *                       enum: [GRANT, DENY]
 *     responses:
 *       200:
 *         description: Bulk allocation completed
 */
