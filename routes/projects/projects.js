module.exports = function (dirname) {
  var express = require('express');
  const helpers = require('../../helpers/util');
  var router = express.Router();
  const db = require('../../db')
  var membersRouter = require('./members/members');
  var issuesRouter = require('./issues/issues')(dirname);
  /* GET users listing. */

  router.get('/', helpers.isLoggedIn, function (rq, rs, next) {
    let url = rq.originalUrl.split('/projects').pop().split('?').pop();
    let sort = {
      prop: '',
      rule: ''
    }
    if (!(url.includes('sort'))) {
      sort.prop = 'projectid';
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
      projectid: rq.query.checkprojectid && rq.query.projectid ? parseInt(rq.query.projectid) : null,
      name: rq.query.checkname ? `%${rq.query.name.toLowerCase()}%` : null,
      member: rq.query.checkmember ? `%${rq.query.member}%` : null,
    }
    let check = {
      projectid: rq.query.checkprojectid ? rq.query.projectid : '',
      name: rq.query.checkname ? rq.query.name : '',
      member: rq.query.checkmember ? rq.query.member : ''
    }
    for (q in query) {
      if (query[q] === null) {
        delete query[q];
      }
    }
    let filterQuery = '';
    let filterArr = [];
    if (Object.values(query).length > 0) {
      let i = 1;
      for (q in query) {
        if (q === 'projectid') {
          filterQuery += `projectid = $${i},`
        } else if (q === 'name') {
          filterQuery += `LOWER(name) LIKE $${i},`
        } else if (q === 'member') {
          filterQuery += `members LIKE $${i},`
        }
        filterArr.push(query[q]);
        i++;
      }
      filterQuery = filterQuery.split(',');
      filterQuery.pop();
      filterQuery[0] = `WHERE ${filterQuery[0]}`;
      filterQuery = filterQuery.join(' AND ')
    }
    db.query(`SELECT userid, firstname FROM users`, (err, res) => {
      if (err) {
        err.code = 500;
        return next(err);
      }
      let members = res.rows;
      db.query(`SELECT projectoption from users WHERE userid = ${rq.session.user.userid}`, (err, res) => {
        if (err) {
          err.code = 500;
          return next(err);
        }
        let option = { projectid: false, name: false, members: false }
        if (res.rows[0].projectoption.length > 0) {
          res.rows[0].projectoption.forEach(el => {
            option[el] = true
          });
        }
        db.query(`SELECT projectid, name, members FROM (SELECT p.projectid, p.name, string_agg(u.firstname, ',' ORDER BY u.userid) members FROM projects p LEFT JOIN members m ON p.projectid = m.projectid LEFT JOIN users u ON u.userid = m.userid GROUP BY p.projectid) AS projectmember ${filterQuery} ORDER BY ${sort.prop} ${sort.rule} LIMIT 3 OFFSET ${rq.query.page ? (rq.query.page - 1) * 3 : 0}`, filterArr, (err, res) => {
          if (err) {
            err.code = 500;
            return next(err);
          }
          let data = res.rows;
          db.query(`SELECT COUNT(projectid) AS total FROM (SELECT projectid, name, members FROM (SELECT p.projectid, p.name, string_agg(u.firstname, ',' ORDER BY u.userid) members FROM projects p LEFT JOIN members m ON p.projectid = m.projectid LEFT JOIN users u ON u.userid = m.userid GROUP BY p.projectid) AS projectmember ${filterQuery} ORDER BY ${sort.prop} ${sort.rule}  ) as projects`, filterArr, (err, res) => {
            if (err) {
              err.code = 500;
              return next(err);
            }
            let result = {
              data,
              page: parseInt(rq.query.page),
              total: res.rows[0] ? parseInt(res.rows[0].total) : 0
            }
            rs.render('projects/list', { nav: 'projects', query: url, sort, user: rq.session.user, result, members, option, check, breadmessage: rq.flash('breadmessage') });
            rs.status(200);
          })
        })
      })
    })

  });

  router.get('/add', helpers.isLoggedIn, (rq, rs, next) => {
    db.query('SELECT userid, firstname, lastname FROM users', (err, res) => {
      if (err) {
        err.code = 500;
        return next(err);
      }
      rs.render('projects/form', { nav: 'projects', user: rq.session.user, members: res.rows, form: 'add' });
    })
  })

  router.post('/', helpers.isLoggedIn, (rq, rs, next) => {
    let data = rq.body;
    let members = [];
    if (Array.isArray(data.userid)) {
      members = data.userid
    } else {
      if (data.userid) {
        members = data.userid.split();
      }
    }
    db.query(`INSERT INTO projects(name) values 
          ($1) RETURNING *;`,
      [
        data.name
      ], (err, res) => {
        if (err) {
          err.code = 500;
          return next(err);
        }
        let projectid = res.rows[0].projectid;
        let valuesvar = '';
        let valuesvalue = []
        members.forEach((el, index) => {
          if (index + 1 === members.length) {
            if (index === 0) {
              valuesvar += `($${index + 1}, $${index + 2})`
            } else {
              valuesvar += `($${index + (index + 1)}, $${index + (index + 2)})`
            }
          } else {
            if (index === 0) {
              valuesvar += `($${index + 1}, $${index + 2}), `
            } else {
              valuesvar += `($${index + (index + 1)}, $${index + (index + 2)}), `
            }
          }
          valuesvalue.push(`${el}`)
          valuesvalue.push(`${projectid}`)
        });
        db.query(`INSERT INTO members(userid, projectid) VALUES ${valuesvar} RETURNING *`,
          valuesvalue,
          (err, res) => {
            if (err) {
              err.code = 500;
              return next(err);
            }
            rq.flash('breadmessage', 'Projek berhasil ditambahkan')
            rs.redirect('/projects')
            rs.status(201);
          })
      });
  })

  router.get('/edit/:projectid', helpers.isLoggedIn, (rq, rs, next) => {
    db.query(`SELECT projectid, name, members FROM (SELECT p.projectid, p.name, array_agg(u.userid) members FROM projects p LEFT JOIN members m ON p.projectid = m.projectid LEFT JOIN users u ON u.userid = m.userid GROUP BY p.projectid) AS projectmember WHERE projectid = $1`, [rq.params.projectid], (err, res) => {
      if (err) {
        err.code = 500;
        return next(err);
      }
      let project = res.rows[0];
      db.query(`SELECT userid, firstname, lastname FROM users`, (err, res) => {
        if (err) {
          err.code = 500;
          return next(err);
        }
        let members = res.rows;
        rs.render('projects/form', { nav: 'projects', user: rq.session.user, members, form: 'edit', project });
      });
    })
  })

  router.post('/edit/:projectid', helpers.isLoggedIn, (rq, rs, next) => {
    let data = rq.body;
    db.query(`UPDATE projects SET name = $1 WHERE projectid = $2 RETURNING *`,
      [
        data.name,
        rq.params.projectid
      ], (err, res) => {
        if (err) {
          err.code = 500;
          return next(err);
        }
        db.query(`DELETE FROM members WHERE projectid = $1`, [rq.params.projectid], (err, res) => {
          if (err) {
            err.code = 500;
            return next(err);
          }
          let members = [];
          if (Array.isArray(data.userid)) {
            members = data.userid
          } else {
            if (data.userid) {
              members = data.userid.split();
            }
          }
          let projectid = rq.params.projectid;
          let valuesvar = '';
          let valuesvalue = []
          members.forEach((el, index) => {
            if (index + 1 === members.length) {
              if (index === 0) {
                valuesvar += `($${index + 1}, $${index + 2})`
              } else {
                valuesvar += `($${index + (index + 1)}, $${index + (index + 2)})`
              }
            } else {
              if (index === 0) {
                valuesvar += `($${index + 1}, $${index + 2}), `
              } else {
                valuesvar += `($${index + (index + 1)}, $${index + (index + 2)}), `
              }
            }
            valuesvalue.push(`${el}`)
            valuesvalue.push(`${projectid}`)
          });
          db.query(`INSERT INTO members(userid, projectid) VALUES ${valuesvar} RETURNING *`,
            valuesvalue,
            (err, res) => {
              if (err) {
                err.code = 500;
                return next(err);
              }
              rq.flash('breadmessage', 'Projek berhasil diubah')
              rs.redirect('/projects')
              rs.status(201);
            })

        })
      })
  })

  router.get('/delete/:projectid', helpers.isLoggedIn, (rq, rs, next) => {
    if (rq.session.user.role !== 'admin') {
      return rs.status(401).send('Unauthorized');
    }
    db.query(`DELETE FROM projects WHERE projectid = $1`,
      [
        rq.params.projectid
      ], (err, res) => {
        if (err) {
          err.code = 500;
          return next(err);
        }
        rs.status(200);
        rq.flash('breadmessage', 'Projek berhasil dihapus')
        rs.redirect('/projects')
      })
  })

  router.post('/option', helpers.isLoggedIn, (rq, rs, next) => {
    let data = rq.body;
    let userid = rq.session.user.userid;
    let option = []
    if (data.optionprojectid) option.push('projectid');
    if (data.optionname) option.push('name')
    if (data.optionmembers) option.push('members')
    db.query(`UPDATE users set projectoption = $1
  WHERE userid = $2`,
      [
        option,
        userid
      ], (err, res) => {
        if (err) {
          err.code = 500;
          return next(err);
        }
        rq.flash('breadmessage', 'Opsi berhasil disimpan')
        rs.redirect('/projects')
      })
  })

  router.get('/overview/:projectid', helpers.isLoggedIn, function (rq, rs, next) {
    db.query(`SELECT p.name, array_agg(u.firstname || ' ' || u.lastname) AS members FROM projects p LEFT JOIN members m USING(projectid) LEFT JOIN users u USING(userid) WHERE p.projectid = $1 GROUP BY p.name`,
      [rq.params.projectid],
      (err, res) => {
        if (err) {
          err.code = 500;
          return next(err);
        }
        let project = res.rows[0];
        db.query(`SElECT 
    COUNT(*) FILTER (WHERE tracker = 'bug' AND status != 'closed') AS bugopen ,COUNT(*) FILTER (WHERE tracker = 'bug') AS bugtotal,
    COUNT(*) FILTER (WHERE tracker = 'feature' AND status != 'closed') AS featureopen ,COUNT(*) FILTER (WHERE tracker = 'feature') AS featuretotal,
    COUNT(*) FILTER (WHERE tracker = 'support' AND status != 'closed') AS supportopen ,COUNT(*) FILTER (WHERE tracker = 'support') AS supporttotal
    FROM issues WHERE projectid = $1
    `,
          [rq.params.projectid],
          (err, res) => {
            if (err) {
              err.code = 500;
              return next(err);
            }
            let issuecount = res.rows[0];
            rs.render('projects/overview/view', { nav: 'projects', side: 'overview', projectid: rq.params.projectid, user: rq.session.user, project, issuecount });
          })
      })
  });

  router.get('/activity/:projectid', helpers.isLoggedIn, function (rq, rs, next) {
    db.query(`SELECT p.name, array_agg(u.firstname || ' ' || u.lastname) AS members FROM projects p LEFT JOIN members m USING(projectid) LEFT JOIN users u USING(userid) WHERE p.projectid = $1 GROUP BY p.name`,
      [rq.params.projectid],
      (err, res) => {
        if (err) {
          err.code = 500;
          return next(err);
        }
        let project = res.rows[0];
        db.query(`SELECT a.activityid, a.issueid, i.subject, i.status, a.description, a.projectid, a.time, u.firstname as author, TO_CHAR (a.time, 'HH24:MI') AS hour, TO_CHAR (a.time, 'DD/MM/YYYY') AS date, TO_CHAR (a.time, 'Day') AS day  FROM activity a INNER JOIN users u ON a.author = u.userid 
        INNER JOIN issues i ON a.issueid = i.issueid
        WHERE a.projectid = $1 AND a.time >= CURRENT_TIMESTAMP - interval '6 day' GROUP BY a.time, a.activityid, u.userid, i.issueid ORDER BY a.time DESC`,
          [rq.params.projectid],
          (err, res) => {
            if (err) {
              err.code = 500;
              return next(err);
            }
            let activity = res.rows;
            rs.render('projects/activity/view', { nav: 'projects', side: 'activity', projectid: rq.params.projectid, user: rq.session.user, project, activity });
          })
      })
  });

  router.use('/members', membersRouter);
  router.use('/issues', issuesRouter);

  return router;
}
