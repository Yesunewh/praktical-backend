/**
 * @swagger
 * tags:
 *   - name: Units
 *     description: Hierarchical Branches and Unit Types Configuration
 * 
 * /units/types:
 *   post:
 *     summary: Create a Unit Type (e.g. Level 1 Region, Level 2 City)
 *     tags: [Units]
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
 *               - level
 *             properties:
 *               name:
 *                 type: string
 *               level:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Unit Type created
 *   get:
 *     summary: Fetch all defined Unit Types
 *     tags: [Units]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of Unit Types
 * 
 * /units:
 *   post:
 *     summary: Create an Organizational Unit (Branch)
 *     tags: [Units]
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
 *               - type_id
 *             properties:
 *               name:
 *                 type: string
 *               type_id:
 *                 type: string
 *                 format: uuid
 *               parent_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of parent unit (if sub-branch)
 *     responses:
 *       201:
 *         description: Unit Created
 *   get:
 *     summary: Fetch all units
 *     tags: [Units]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of units
 * 
 * /units/tree:
 *   get:
 *     summary: Fetch the full hierarchical tree of branches
 *     tags: [Units]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nested JSON tree of units
 *
 * /units/{id}:
 *   get:
 *     summary: Get unit by ID
 *     tags: [Units]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Unit details
 *   patch:
 *     summary: Update unit details
 *     tags: [Units]
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
 *               type_id:
 *                 type: string
 *                 format: uuid
 *               parent_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Unit updated
 */
