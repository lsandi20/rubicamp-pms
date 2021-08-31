module.exports = function (dirname) {
  var fs = require('fs');
  var express = require('express');
  const helpers = require('../../../helpers/util');
  var router = express.Router();
  const db = require('../../../db')
  var path = require('path');

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
      if (err) {
        return rs.status(500).send(err);
      }
      let members = res.rows;
      db.query(`SELECT issueoption from users WHERE userid = ${rq.session.user.userid}`, (err, res) => {
        if (err) {
          return rs.status(500).send(err);
        }
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
            return rs.status(500).send(err);
          }
          let data = res.rows;
          db.query(`SELECT COUNT(issueid) AS total FROM (SELECT i.issueid, i.tracker, i.subject, i.description, i.status, i.priority, asi.firstname as assignee, i.startdate, i.duedate, i.estimatedtime, i.spenttime, i.targetversion, au.firstname as author, i.createddate, i.updateddate, i.closeddate, pt.subject AS parenttask, i.done
        FROM issues i LEFT JOIN users asi ON asi.userid = i.assignee LEFT JOIN users au ON au.userid = i.author LEFT JOIN  issues pt ON pt.issueid = i.parenttask ${filterQuery} ORDER BY ${sort.prop} ${sort.rule}  ) as issues`, filterArr, (err, res) => {
            if (err) {
              return rs.status(500).send(err);
            }
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



  router.post('/option/:projectid', helpers.isLoggedIn, (rq, rs) => {
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
        if (err) {
          return rs.status(500).send(err);
        }
        rs.redirect(`/projects/issues/${rq.params.projectid}`)
      })
  })

  router.get('/:projectid/add', helpers.isLoggedIn, (rq, rs) => {
    db.query(`SELECT u.userid, u.firstname FROM members m INNER JOIN users u ON m.userid = u.userid WHERE m.projectid = $1`, [rq.params.projectid], (err, res) => {
      if (err) {
        return rs.status(500).send(err);
      }
      rs.render('projects/issues/add', { nav: 'projects', side: 'issues', user: rq.session.user, projectid: rq.params.projectid, members: res.rows });
    })
  })


  router.post('/:projectid', helpers.isLoggedIn, (rq, rs) => {
    let data = rq.body;
    let files = [];
    let promiseArray = [];
    if (rq.files !== null) {
      if (Array.isArray(rq.files.files)) {
        rq.files.files.forEach((f) => {
          let filename = `${Date.now()}${f.name}`
          let fileuri = path.join(dirname, 'public/files', filename)
          files.push({ name: f.name, type: f.mimetype, path: `/files/${filename}` })
          promiseArray.push(f.mv(fileuri))
        })
      } else {
        let f = rq.files.files
        let filename = `${Date.now()}${f.name}`
        let fileuri = path.join(dirname, 'public/files', filename)
        files.push({ name: f.name, type: f.mimetype, path: `/files/${filename}` })
        promiseArray.push(f.mv(fileuri))
      }
    }
    Promise.all(promiseArray).then(() => {
      db.query(`INSERT INTO issues(projectid, tracker, subject, description, status, priority, assignee, startdate, duedate, estimatedtime, author, createddate, updateddate, done, files) VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *;`,
        [
          rq.params.projectid,
          data.tracker, data.subject || null, data.description || null, data.status, data.priority, data.assignee || null, data.startdate, data.duedate || null, data.estimatedtime, rq.session.user.userid, new Date(), new Date(), data.done || null,
          files || null
        ],
        (err, res) => {
          if (err) {
            return rs.status(500).send(err);
          }
          rs.redirect(`/projects/issues/${rq.params.projectid}`)
          rs.status(201);
        })
    }).catch(err => {
      if (err) {
        return rs.status(500).send(err);
      }
    })

  })

  router.get('/delete/:projectid/:issueid', helpers.isLoggedIn, (rq, rs) => {
    db.query(`SELECT files FROM issues WHERE issueid = $1`, [
      rq.params.issueid,
    ], (err, result) => {
      if (err) {
        return rs.status(500).send(err);
      }
      db.query(`DELETE FROM issues WHERE issueid = $1`,
        [
          rq.params.issueid,
        ], (err, res) => {
          if (err) {
            return rs.status(500).send(err);
          }
          if (result.rows[0].files !== null) {
            result.rows[0].files.forEach((f) => {
              try {
                fs.unlinkSync(f.path);
              } catch (error) {
                console.error('file not found');
              }
            })
          }
          rs.status(200);
          rs.redirect(`/projects/issues/${rq.params.projectid}`)
        })
    })

  })

  router.get('/edit/:projectid/:issueid', helpers.isLoggedIn, (rq, rs) => {
    db.query(`SELECT u.userid, u.firstname FROM members m INNER JOIN users u ON m.userid = u.userid WHERE m.projectid = $1`, [rq.params.projectid], (err, res) => {
      if (err) {
        return rs.status(500).send(err);
      }
      db.query(`SELECT issueid, subject FROM issues`, [], (err, data) => {
        if (err) {
          return rs.status(500).send(err);
        }
        db.query(`SELECT *, TO_CHAR (startdate, 'YYYY-MM-DD') startdate, TO_CHAR (duedate, 'YYYY-MM-DD') duedate , TO_CHAR (createddate, 'YYYY-MM-DD') createddate, TO_CHAR (updateddate, 'YYYY-MM-DD') updateddate, users.firstname as author FROM issues INNER JOIN users ON issues.author = users.userid WHERE issueid = $1`, [rq.params.issueid],
          (err, result) => {
            if (err) {
              return rs.status(500).send(err);
            }
            rs.render('projects/issues/edit', { nav: 'projects', side: 'issues', user: rq.session.user, projectid: rq.params.projectid, issueid: rq.params.issueid, members: res.rows, result: result.rows[0], issues: data.rows });
          })
      })

    })
  })

  router.post('/edit/:projectid/:issueid', helpers.isLoggedIn, (rq, rs) => {
    db.query(`SELECT status FROM issues WHERE issueid = $1`, [rq.params.issueid], (err, res) => {
      if (err) {
        return rs.status(500).send(err);
      }
      if (res.rows[0].status === 'closed') {
        return rs.redirect(`/projects/issues/${rq.params.projectid}`);
      } else {
        let data = rq.body;
        let files = [];
        if (data.previousFile) {
          if (Array.isArray(data.previousFile)) {
            data.previousFile.forEach((f) => {
              files.push(f);
            })
          } else {
            files.push(data.previousFile)
          }
        }
        if (data.deletedFile) {
          if (Array.isArray(data.deletedFile)) {
            data.deletedFile.forEach((f) => {
              try {
                fs.unlinkSync(f.path);
              } catch (error) {
                console.error('file not found');
              }
            })
          } else {
            try {
              fs.unlinkSync(data.deletedFile.path);
            } catch (error) {
              console.error('file not found');
            }
          }
        }
        let promiseArray = [];
        if (rq.files !== null) {
          if (Array.isArray(rq.files.files)) {
            rq.files.files.forEach((f) => {
              let filename = `${Date.now()}${f.name}`
              let fileuri = path.join(dirname, 'public/files', filename)
              files.push({ name: f.name, type: f.mimetype, path: `/files/${filename}` })
              promiseArray.push(f.mv(fileuri))
            })
          } else {
            let f = rq.files.files
            let filename = `${Date.now()}${f.name}`
            let fileuri = path.join(dirname, 'public/files', filename)
            files.push({ name: f.name, type: f.mimetype, path: `/files/${filename}` })
            promiseArray.push(f.mv(fileuri))
          }
        }
        Promise.all(promiseArray).then(() => {
          let updateddate = new Date();
          db.query(`UPDATE issues SET tracker = $1, subject = $2, description = $3,
           status = $4, priority = $5, assignee = $6, startdate = $7, duedate = $8, 
           estimatedtime = $9, spenttime = $10, targetversion = $11,
             updateddate = $12, closeddate = $13, parenttask = $14, done = $15, 
            files = $16
            WHERE issueid = $17
           RETURNING *;`,
            [
              data.tracker, data.subject || null, data.description || null, data.status, data.priority, data.assignee || null, data.startdate, data.duedate || null, data.estimatedtime, data.spenttime || null, data.targetversion || null, updateddate, data.closeddate || null, data.parenttask || null, data.done || null,
              files || null,
              rq.params.issueid
            ],
            (err, res) => {
              if (err) {
                return rs.status(500).send(err);
              }
              db.query('INSERT INTO activity(projectid, time, title, description, author) VALUES ($1, $2, $3, $4, $5)', [
                rq.params.projectid,
                new Date(),
                data.subject,
                data.description || '',
                rq.session.user.userid
              ], (err, res) => {
                if (err) {
                  return rs.status(500).send(err);
                }
                rs.redirect(`/projects/issues/${rq.params.projectid}`)
                rs.status(201);
              })
            })
        }).catch(err => {
          if (err) {
            return rs.status(500).send(err);
          }
        })

      }
    })
  })


  return router;
}
