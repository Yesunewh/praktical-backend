/**
 * @swagger
 * tags:
 *   - name: Gamification - Categories
 *     description: Challenge category management
 *   - name: Gamification - Challenges
 *     description: Core challenge management and rating
 *   - name: Gamification - Assignments
 *     description: Training assignment management for admins and users
 *   - name: Gamification - User Progress
 *     description: Personal progress, achievements, and statistics
 *   - name: Gamification - Leaderboards
 *     description: Rankings and leaderboard snapshot management
 *
 * /gamification/categories:
 *   get:
 *     summary: List all challenge categories
 *     tags: [Gamification - Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 *   post:
 *     summary: Create a new challenge category (Platform Administrator)
 *     tags: [Gamification - Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Category created
 *
 * /gamification/categories/{id}:
 *   put:
 *     summary: Update challenge category (Platform Administrator)
 *     tags: [Gamification - Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Category updated
 *   delete:
 *     summary: Remove challenge category (Platform Administrator)
 *     tags: [Gamification - Categories]
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
 *         description: Category removed
 *
 * /gamification/challenges:
 *   get:
 *     summary: List all available challenges
 *     tags: [Gamification - Challenges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [EASY, MEDIUM, HARD]
 *       - in: query
 *         name: for_exam_bank
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of challenges
 *   post:
 *     summary: Create a new challenge
 *     tags: [Gamification - Challenges]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LearningChallenge'
 *     responses:
 *       201:
 *         description: Challenge created
 *
 * /gamification/challenges/{id}:
 *   get:
 *     summary: Get challenge details
 *     tags: [Gamification - Challenges]
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
 *     tags: [Gamification - Challenges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LearningChallenge'
 *     responses:
 *       200:
 *         description: Challenge updated
 *   delete:
 *     summary: Remove challenge
 *     tags: [Gamification - Challenges]
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
 *     tags: [Gamification - Challenges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               score:
 *                 type: number
 *               time_taken:
 *                 type: number
 *     responses:
 *       200:
 *         description: Completion processed
 *
 * /gamification/challenges/{id}/rate:
 *   post:
 *     summary: Rate a challenge
 *     tags: [Gamification - Challenges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rating submitted
 *
 * /gamification/training-summary:
 *   get:
 *     summary: Admin training summary
 *     description: High-level analytics and reporting for administrators. Includes platform health metrics and top performer lists.
 *     tags: [Gamification - Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: org_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: dept_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Summary analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 summary:
 *                   type: object
 *                   properties:
 *                     scopeLabel:
 *                       type: string
 *                     userCount:
 *                       type: integer
 *                     activeUserCount:
 *                       type: integer
 *                     totalAttempts:
 *                       type: integer
 *                     passRate:
 *                       type: integer
 *                     avgScore:
 *                       type: integer
 *                     avgTimeSpent:
 *                       type: integer
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                           usersWithPass:
 *                             type: integer
 *                           passAttempts:
 *                             type: integer
 *                     topChallengers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           rank:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           xp:
 *                             type: integer
 *                           challengesCompleted:
 *                             type: integer
 *                     popularChallenges:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           attempt_count:
 *                             type: integer
 *
 * /gamification/progress/me:
 *   get:
 *     summary: Get current user progress
 *     tags: [Gamification - User Progress]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progress data
 *
 * /gamification/assignments/me:
 *   get:
 *     summary: Get my training assignments
 *     tags: [Gamification - Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, LATE]
 *         description: Filter assignments by status.
 *     responses:
 *       200:
 *         description: List of my training assignments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 assignments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       challengeId:
 *                         type: string
 *                       dueDate:
 *                         type: string
 *                         format: date
 *                       status:
 *                         type: string
 *                         enum: [COMPLETED, PENDING, LATE]
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                       score:
 *                         type: integer
 *
 * /gamification/assignments:
 *   get:
 *     summary: List all training assignments (Admin)
 *     tags: [Gamification - Assignments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assignments
 *   post:
 *     summary: Create a training assignment
 *     description: Assign a challenge to a single user or an entire group (Organization, Department, or Branch).
 *     tags: [Gamification - Assignments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - challenge_id
 *               - title
 *               - due_date
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Monthly Security Awareness"
 *               challenge_id:
 *                 type: string
 *                 example: "pw-basics"
 *               due_date:
 *                 type: string
 *                 format: date
 *                 example: "2024-12-31"
 *               assign_all:
 *                 type: boolean
 *                 description: Set to true to target a group. Requires org_id/dept_id/unit_id.
 *               user_id:
 *                 type: string
 *                 description: Target a single user. Required if assign_all is false.
 *               org_id:
 *                 type: string
 *                 format: uuid
 *               dept_id:
 *                 type: string
 *                 format: uuid
 *               unit_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Assignment created
 *
 * /gamification/assignments/{id}:
 *   delete:
 *     summary: Remove a training assignment
 *     tags: [Gamification - Assignments]
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
 *         description: Assignment removed
 *
 * /gamification/assignments/{id}/report:
 *   get:
 *     summary: Get detailed compliance report for an assignment
 *     description: Lists all users targeted by the assignment and their individual completion status (COMPLETED, PENDING, or LATE).
 *     tags: [Gamification - Assignments]
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
 *         description: Detailed compliance report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 title:
 *                   type: string
 *                 dueDate:
 *                   type: string
 *                   format: date
 *                 report:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [COMPLETED, PENDING, LATE]
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                       score:
 *                         type: integer
 *
 *
 * /gamification/achievements/me:
 *   get:
 *     summary: Get my achievements
 *     tags: [Gamification - User Progress]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of achievements
 *
 * /gamification/leaderboard:
 *   get:
 *     summary: Get current leaderboard
 *     tags: [Gamification - Leaderboards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [global, org, dept, unit]
 *       - in: query
 *         name: org_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Leaderboard entries
 *
 * /gamification/leaderboard/snapshot:
 *   post:
 *     summary: Create a leaderboard snapshot
 *     tags: [Gamification - Leaderboards]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scope:
 *                 type: string
 *                 enum: [global, org, dept, unit]
 *     responses:
 *       201:
 *         description: Snapshot created
 *
 * /gamification/leaderboard/snapshots:
 *   get:
 *     summary: List leaderboard snapshots
 *     tags: [Gamification - Leaderboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of snapshots
 *
 * components:
 *   schemas:
 *     ChallengeStep:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [information, question, scenario, sequential, image-verification, phishing-inbox, video-check, policy-attestation, password-create]
 *         content:
 *           type: object
 *           description: Dynamic content based on step type
 *         explanation:
 *           type: string
 *
 *     LearningChallenge:
 *       type: object
 *       required:
 *         - id
 *         - title
 *         - category
 *         - type
 *         - difficulty
 *       properties:
 *         id:
 *           type: string
 *           example: "pw-basics"
 *         title:
 *           type: string
 *           example: "Password Security Basics"
 *         description:
 *           type: string
 *         type:
 *           type: string
 *           example: "password"
 *         category:
 *           type: string
 *           example: "password"
 *         difficulty:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *         duration:
 *           type: integer
 *           description: Estimated time in minutes
 *         xp_reward:
 *           type: integer
 *           default: 100
 *         reputation_reward:
 *           type: integer
 *           default: 10
 *         steps:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChallengeStep'
 *         is_active:
 *           type: boolean
 *           default: true
 *         org_id:
 *           type: string
 *           format: uuid
 *         dept_id:
 *           type: string
 *           format: uuid
 *         unit_id:
 *           type: string
 *           format: uuid
 */

/**
 * @swagger
 * /gamification/analytics/top-rated:
 *   get:
 *     summary: Get top-rated challenges (Analytics)
 *     description: Returns the top 5 challenges based on average user ratings. Admins only see data for their org.
 *     tags: [Gamification - Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of challenges to return.
 *     responses:
 *       200:
 *         description: List of top-rated challenges
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 challenges:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       challengeId:
 *                         type: string
 *                       title:
 *                         type: string
 *                       category:
 *                         type: string
 *                       difficulty:
 *                         type: string
 *                       avgRating:
 *                         type: number
 *                         format: float
 *                       ratingCount:
 *                         type: integer
 */
