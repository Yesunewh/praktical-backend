const { LearningChallenge } = require('../src/models');

async function run() {
  const c = await LearningChallenge.findAll({
    where: { is_active: true }
  });
  console.log('Total challenges:', c.length);
  const orgs = c.filter(x => x.org_id != null);
  const globals = c.filter(x => x.org_id == null);
  const depts = c.filter(x => x.dept_id != null);
  console.log('Global challenges:', globals.length);
  console.log('Org challenges:', orgs.length);
  console.log('Dept challenges:', depts.length);
  process.exit(0);
}

run().catch(console.error);
