/**
 * @swagger
 * tags:
 *   - name: Organizations
 *     description: Platform-level tenant management (Super Admin)
 *
 * components:
 *   schemas:
 *     Organization:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         logo_url:
 *           type: string
 *         status:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED, PENDING]
 *         subscription_plan:
 *           type: string
 *           enum: [BASIC, PREMIUM, ENTERPRISE]
 *
 * /organizations:
 *   post:
 *     summary: Create a new organization (Super Admin only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *                 example: Acme Corp
 *               slug:
 *                 type: string
 *                 example: acme-corp
 *               logo_url:
 *                 type: string
 *               subscription_plan:
 *                 type: string
 *                 enum: [BASIC, PREMIUM, ENTERPRISE]
 *     responses:
 *       201:
 *         description: Organization created successfully
 *       400:
 *         description: Slug already exists or validation error
 *
 *   get:
 *     summary: Get all organizations (Super Admin only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of organizations
 *
 * /organizations/{id}:
 *   get:
 *     summary: Get organization details by ID
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *     responses:
 *       200:
 *         description: Organization details
 *   patch:
 *     summary: Update organization details
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               name:
 *                 type: string
 *               logo_url:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED, PENDING]
 *               subscription_plan:
 *                 type: string
 *                 enum: [BASIC, PREMIUM, ENTERPRISE]
 *     responses:
 *       200:
 *         description: Organization updated
 */
