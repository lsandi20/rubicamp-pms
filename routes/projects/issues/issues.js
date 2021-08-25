var express = require('express');
const helpers = require('../../../helpers/util');
var router = express.Router();
const db = require('../../../db')

router.get('/:projectid', helpers.isLoggedIn, function (rq, rs, next) {
  let url = rq.originalUrl.split(`/projects/${rq.params.projectid}`).pop().split('?').pop();
  let sort = {
    prop: '',
    rule: ''
  }
  if (!(url.includes('sort'))) {
    sort.prop = 'issueid';
    sort.rule = 'ASC';
  } else {
    sort.prop = rq.query.sortp;
    sort.rule = rq.query.sortr;
    url = url.split(`&sortp=${rq.query.sortp}&sortr=${rq.query.sortr}`).shift();
  }
  url = url.split(`page=${rq.query.page}`);
  while (url.length > 1) {
    if (url[0].includes(`page`) || url[0].length === 0) {
      url.shift();
    }
  }
  url = url.join();
  if (url[0] === '&') {
    url = url.slice(1);
  }
  if (url.length === 1) {
    url = ''
  }
  let query = {
    issueid: rq.query.checkissueid ? parseInt(rq.query.issueid) : null,
    subject: rq.query.checksubject ? `%${rq.query.subject.toLowerCase()}%` : null,
    tracker: rq.query.checktracker ? `${rq.query.tracker}` : null,
    status: rq.query.checkstatus ? `${rq.query.status}` : null,
    priority: rq.query.checkpriority ? `${rq.query.priority}` : null,
    assignee: rq.query.checkassignee ? `%${rq.query.assignee.toLowerCase()}%` : null,
  }
  for (q in query) {
    if (query[q] === null) {
      delete query[q];
    }
  }
  let filterQuery = 'WHERE i.projectid = $1';
  let filterArr = [rq.params.projectid];
  if (Object.values(query).length > 0) {
    filterQuery += ' AND '
    let i = 2;
    for (q in query) {
      if (q === 'issueid') {
        filterQuery += `i.issueid = $${i},`
      } else if (q === 'subject') {
        filterQuery += `i.subject ILIKE $${i},`
      } else if (q === 'tracker') {
        filterQuery += `i.tracker = $${i},`
      } else if (q === 'status') {
        filterQuery += `i.status = $${i},`
      } else if (q === 'priority') {
        filterQuery += `i.priority = $${i},`
      } else if (q === 'assignee') {
        filterQuery += `asi.firstname ILIKE $${i},`
      }
      filterArr.push(query[q]);
      i++;
    }
    filterQuery = filterQuery.split(',');
    filterQuery.pop();
    filterQuery = filterQuery.join(' AND ')
  }
  db.query(`SELECT u.firstname FROM members m INNER JOIN users u ON m.userid = u.userid WHERE m.projectid = $1`, [rq.params.projectid], (err, res) => {
    let members = res.rows;
    db.query(`SELECT issueoption from users WHERE userid = ${rq.session.user.userid}`, (err, res) => {
      let option = { userid: false, name: false, position: false }
      if (res.rows[0].issueoption.length > 0) {
        res.rows[0].issueoption.forEach(el => {
          option[el] = true
        });
      }
      db.query(`SELECT i.issueid, i.tracker, i.subject, i.description, i.status, i.priority, asi.firstname as assignee, i.startdate, i.duedate, i.estimatedtime, i.spenttime, i.targetversion, au.firstname as author, i.createddate, i.updateddate, i.closeddate, pt.subject AS parenttask, i.done
    FROM issues i LEFT JOIN users asi ON asi.userid = i.assignee LEFT JOIN users au ON au.userid = i.author LEFT JOIN  issues pt ON pt.issueid = i.parenttask
     ${filterQuery} ORDER BY ${sort.prop} ${sort.rule} LIMIT 3 OFFSET ${rq.query.page ? (rq.query.page - 1) * 3 : 0}`, filterArr, (err, res) => {
        if (err) {
          console.log(err);
          return rs.status(500).end()
        }
        let data = res.rows;
        db.query(`SELECT COUNT(issueid) AS total FROM (SELECT i.issueid, i.tracker, i.subject, i.description, i.status, i.priority, asi.firstname as assignee, i.startdate, i.duedate, i.estimatedtime, i.spenttime, i.targetversion, au.firstname as author, i.createddate, i.updateddate, i.closeddate, pt.subject AS parenttask, i.done
        FROM issues i LEFT JOIN users asi ON asi.userid = i.assignee LEFT JOIN users au ON au.userid = i.author LEFT JOIN  issues pt ON pt.issueid = i.parenttask ${filterQuery} ORDER BY ${sort.prop} ${sort.rule}  ) as issues`, filterArr, (err, res) => {
          let result = {
            data,
            page: parseInt(rq.query.page),
            total: res.rows[0] ? parseInt(res.rows[0].total) : 0
          }
          rs.render('projects/issues/list', { nav: 'projects', side: 'issues', query: url, sort, projectid: rq.params.projectid, user: rq.session.user, result, option, members });
          rs.status(200);
        })
      })
    })
  })
});



router.post('/option/:projectid', (rq, rs) => {
  let data = rq.body;
  let userid = rq.session.user.userid;
  let option = []
  if (data.optionissueid) option.push('issueid');
  if (data.optionsubject) option.push('subject')
  if (data.optiontracker) option.push('tracker')
  if (data.optionstatus) option.push('status');
  if (data.optionpriority) option.push('priority')
  if (data.optionassignee) option.push('assignee')
  if (data.optiondescription) option.push('description');
  if (data.optionstartdate) option.push('startdate')
  if (data.optionduedate) option.push('duedate')
  if (data.optionestimatedtime) option.push('estimatedtime');
  if (data.optionspenttime) option.push('spenttime')
  if (data.optiontargetversion) option.push('targetversion')
  if (data.optionauthor) option.push('author');
  if (data.optioncreateddate) option.push('createddate')
  if (data.optionupdateddate) option.push('updateddate')
  if (data.optioncloseddate) option.push('closeddate');
  if (data.optionparenttask) option.push('parenttask')
  if (data.optiondone) option.push('done')
  db.query(`UPDATE users set issueoption = $1
  WHERE userid = $2`,
    [
      option,
      userid
    ], (err, res) => {
      rs.redirect(`/projects/issues/${rq.params.projectid}`)
    })
})

router.get('/:projectid/add', helpers.isLoggedIn, (rq, rs) => {
  db.query('SELECT * FROM users WHERE userid NOT IN (SELECT userid FROM members WHERE projectid = $1);', [rq.params.projectid], (err, res) => {
    rs.render('projects/members/form', { nav: 'projects', side: 'members', user: rq.session.user, projectid: rq.params.projectid, members: res.rows, form: 'add' });
  })
})


router.post('/:projectid', (rq, rs) => {
  db.query(`INSERT INTO members(projectid, userid, role) values 
      ($1, $2, $3) RETURNING *;`,
    [
      rq.params.projectid,
      rq.body.userid,
      rq.body.role
    ],
    (err, res) => {
      rs.redirect(`/projects/members/${rq.params.projectid}`)
      rs.status(201);
    })
})

router.get('/delete/:projectid/:userid', (rq, rs) => {
  db.query(`DELETE FROM members WHERE userid = $1 AND projectid = $2`,
    [
      rq.params.userid,
      rq.params.projectid
    ], (err, res) => {
      rs.status(200);
      rs.redirect(`/projects/members/${rq.params.projectid}`)
    })
})

router.get('/edit/:projectid/:userid', helpers.isLoggedIn, (rq, rs) => {
  db.query(`SELECT m.userid, u.firstname, m.role FROM members m INNER JOIN users u USING(userid) WHERE m.projectid = $1 AND m.userid = $2`, [rq.params.projectid, rq.params.userid], (err, res) => {
    rs.render('projects/members/form', { nav: 'projects', side: 'members', user: rq.session.user, projectid: rq.params.projectid, members: res.rows, form: 'edit' });
  })
})

router.post('/edit/:projectid/:userid', (rq, rs) => {
  let data = rq.body;
  db.query(`UPDATE members SET role = $1 WHERE projectid = $2 AND userid = $3 RETURNING *`,
    [
      data.role,
      rq.params.projectid,
      rq.params.userid
    ], (err, res) => {
      rs.status(201);
      rs.redirect(`/projects/members/${rq.params.projectid}`)
    })
})


module.exports = router;
