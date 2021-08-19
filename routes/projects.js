var express = require('express');
const helpers = require('../helpers/util');
var router = express.Router();
const db = require('../db')

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
    projectid: rq.query.checkprojectid ? parseInt(rq.query.projectid) : null,
    name: rq.query.checkname ? `%${rq.query.name}%` : null,
    member: rq.query.checkmember ? `%${rq.query.member}%` : null,
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
        filterQuery += `name LIKE $${i},`
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
    let members = res.rows;
    db.query(`SELECT option from users WHERE userid = ${rq.session.user.userid}`, (err, res) => {
      let option = { projectid: false, name: false, members: false }
      if (res.rows[0].option.length > 0) {
        res.rows[0].option.forEach(el => {
          option[el] = true
        });
      }
      db.query(`SELECT projectid, name, members FROM (SELECT p.projectid, p.name, string_agg(u.firstname, ',' ORDER BY u.userid) members FROM projects p LEFT JOIN members m ON p.projectid = m.projectid LEFT JOIN users u ON u.userid = m.userid GROUP BY p.projectid) AS projectmember ${filterQuery} ORDER BY ${sort.prop} ${sort.rule} LIMIT 3 OFFSET ${rq.query.page ? (rq.query.page - 1) * 3 : 0}`, filterArr, (err, res) => {
        if (err) {
          return rs.status(500).end()
        }
        let data = res.rows;
        db.query(`SELECT COUNT(projectid) AS total FROM (SELECT projectid, name, members FROM (SELECT p.projectid, p.name, string_agg(u.firstname, ',' ORDER BY u.userid) members FROM projects p LEFT JOIN members m ON p.projectid = m.projectid LEFT JOIN users u ON u.userid = m.userid GROUP BY p.projectid) AS projectmember ${filterQuery} ORDER BY ${sort.prop} ${sort.rule}  ) as projects`, filterArr, (err, res) => {
          let result = {
            data,
            page: parseInt(rq.query.page),
            total: res.rows[0] ? parseInt(res.rows[0].total) : 0
          }
          rs.render('projects/list', { nav: 'home', query: url, sort, user: rq.session.user, result, members, option });
          rs.status(200);
        })
      })
    })
  })

});

router.post('/', (rq, rs) => {
  let data = rq.body;
  db.query(`INSERT INTO bread(string, integer, float, date, boolean) values 
          ($1, $2, $3, $4, $5) RETURNING *;`,
    [
      data.string || null,
      data.integer || null,
      data.float || null,
      data.date || null,
      data.boolean || null
    ], (err, res) => {
      rs.json(res.rows);
      rs.status(201);
    }
  );
})

router.get('/:id', (rq, rs) => {
  db.query('SELECT * FROM bread WHERE id = $1', [rq.params.id], (err, res) => {
    rs.json(res.rows[0]);
    rs.status(200);
  })
})

router.put('/edit/:id', (rq, rs) => {
  let data = rq.body;
  db.query(`UPDATE bread set string = $1, integer = $2, float = $3, date = $4, boolean = $5
  WHERE id = $6 RETURNING *`,
    [
      data.string || null,
      data.integer || null,
      data.float || null,
      data.date || null,
      data.boolean || null,
      rq.params.id
    ], (err, res) => {
      rs.json(res.rows);
      rs.status(200);
    })
})

router.delete('/delete/:id', (rq, rs) => {
  db.query(`DELETE FROM bread WHERE id = $1`,
    [
      rq.params.id
    ], (err, res) => {
      rs.status(200).end();
    })
})

router.post('/option', (rq, rs) => {
  let data = rq.body;
  let userid = rq.session.user.userid;
  let option = []
  if (data.optionprojectid) option.push('projectid');
  if (data.optionname) option.push('name')
  if (data.optionmembers) option.push('members')
  db.query(`UPDATE users set option = $1
  WHERE userid = $2`,
    [
      option,
      userid
    ], (err, res) => {
      rs.redirect('/projects')
    })
})

module.exports = router;
