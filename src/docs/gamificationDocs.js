/**
 * @swagger
 * tags:
 *   - name: Gamification
 *     description: Learning Challenges, Progress, and Leaderboard
 *
 * /gamification/challenges:
 *   get:
 *     summary: List all available challenges
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of challenges
 *   post:
 *     summary: Create a new challenge
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Challenge created
 *
 * /gamification/challenges/{id}:
 *   get:
 *     summary: Get challenge details
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Challenge details
 *   put:
 *     summary: Update challenge
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Challenge updated
 *   delete:
 *     summary: Remove challenge
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Challenge removed
 *
 * /gamification/challenges/{id}/complete:
 *   post:
 *     summary: Submit challenge completion
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Completion processed
 *
 * /gamification/training-summary:
 *   get:
 *     summary: Admin training summary
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary data
 *
 * /gamification/progress/me:
 *   get:
 *     summary: Get current user progress
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progress data
 *
 * /gamification/leaderboard:
 *   get:
 *     summary: Get current leaderboard
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Leaderboard entries
 */
