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
    sort.prop = 'userid';
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
    userid: rq.query.checkuserid ? parseInt(rq.query.userid) : null,
    firstname: rq.query.checkname ? `%${rq.query.firstname.toLowerCase()}%` : null,
    position: rq.query.checkposition ? `${rq.query.position}` : null,
  }
  for (q in query) {
    if (query[q] === null) {
      delete query[q];
    }
  }
  let filterQuery = 'WHERE m.projectid = $1';
  let filterArr = [rq.params.projectid];
  if (Object.values(query).length > 0) {
    filterQuery += ' AND '
    let i = 2;
    for (q in query) {
      if (q === 'userid') {
        filterQuery += `u.userid = $${i},`
      } else if (q === 'firstname') {
        filterQuery += `LOWER(u.firstname) LIKE $${i},`
      } else if (q === 'position') {
        filterQuery += `m.role = $${i},`
      }
      filterArr.push(query[q]);
      i++;
    }
    filterQuery = filterQuery.split(',');
    filterQuery.pop();
    filterQuery = filterQuery.join(' AND ')
  }
  db.query(`SELECT memberoption from users WHERE userid = ${rq.session.user.userid}`, (err, res) => {
    let option = { userid: false, name: false, position: false }
    if (res.rows[0].memberoption.length > 0) {
      res.rows[0].memberoption.forEach(el => {
        option[el] = true
      });
    }
    db.query(`SELECT u.userid , u.firstname , m.role FROM members m INNER JOIN users u ON m.userid = u.userid ${filterQuery} ORDER BY ${sort.prop} ${sort.rule} LIMIT 3 OFFSET ${rq.query.page ? (rq.query.page - 1) * 3 : 0}`, filterArr, (err, res) => {
      if (err) {
        return rs.status(500).end()
      }
      let data = res.rows;
      db.query(`SELECT COUNT(userid) AS total FROM (SELECT u.userid , u.firstname , m.role FROM members m INNER JOIN users u USING(userid) ${filterQuery} ORDER BY ${sort.prop} ${sort.rule}  ) as members`, filterArr, (err, res) => {
        let result = {
          data,
          page: parseInt(rq.query.page),
          total: res.rows[0] ? parseInt(res.rows[0].total) : 0
        }
        rs.render('projects/members/list', { nav: 'projects', side: 'members', query: url, sort, projectid: rq.params.projectid, user: rq.session.user, result, option });
        rs.status(200);
      })
    })
  })
});



router.post('/option/:projectid', (rq, rs) => {
  let data = rq.body;
  let userid = rq.session.user.userid;
  let option = []
  if (data.optionuserid) option.push('userid');
  if (data.optionname) option.push('name')
  if (data.optionposition) option.push('position')
  db.query(`UPDATE users set memberoption = $1
  WHERE userid = $2`,
    [
      option,
      userid
    ], (err, res) => {
      rs.redirect(`/projects/members/${rq.params.projectid}`)
    })
})


module.exports = router;
