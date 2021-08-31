var express = require('express');
var router = express.Router();
const helpers = require('../helpers/util');
let db = require('../db');
const bcrypt = require('bcrypt');
const saltRound = 10;


router.get('/', helpers.isLoggedIn, function (rq, rs, next) {
  let url = rq.originalUrl.split('/users').pop().split('?').pop();
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
    email: rq.query.checkemail ? `%${rq.query.email.toLowerCase()}%` : null,
    firstname: rq.query.checkfirstname ? `%${rq.query.firstname.toLowerCase()}%` : null,
    lastname: rq.query.checklastname ? `%${rq.query.lastname.toLowerCase()}%` : null,
    position: rq.query.checkposition ? rq.query.position : null,
    fulltime: rq.query.checkfulltime ? rq.query.fulltime : null,
    role: rq.query.checkrole ? rq.query.role : null,
  }
  let check = {
    userid: rq.query.checkuserid ? 'on' : null,
    name: rq.query.checkname ? `on` : null,
    member: rq.query.checkmember ? `on` : null,
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
      if (q === 'userid') {
        filterQuery += `userid = $${i},`
      } else if (q === 'email') {
        filterQuery += `email ILIKE $${i},`
      } else if (q === 'firstname') {
        filterQuery += `firstname ILIKE $${i},`
      } else if (q === 'lastname') {
        filterQuery += `lastname ILIKE $${i},`
      } else if (q === 'position') {
        filterQuery += `position = $${i},`
      } else if (q === 'fulltime') {
        filterQuery += `fulltime = $${i},`
      } else if (q === 'role') {
        filterQuery += `role = $${i},`
      }
      filterArr.push(query[q]);
      i++;
    }
    filterQuery = filterQuery.split(',');
    filterQuery.pop();
    filterQuery[0] = `WHERE ${filterQuery[0]}`;
    filterQuery = filterQuery.join(' AND ')
  }
  db.query(`SELECT useroption from users WHERE userid = ${rq.session.user.userid}`, (err, res) => {
    if (err) {
      return rs.status(500).send(err);
    }
    let option = { userid: false, name: false, members: false }
    if (res.rows[0].useroption.length > 0) {
      res.rows[0].useroption.forEach(el => {
        option[el] = true
      });
    }
    db.query(`SELECT userid, email, firstname, lastname, position, fulltime, role FROM users ${filterQuery} ORDER BY ${sort.prop} ${sort.rule} LIMIT 3 OFFSET ${rq.query.page ? (rq.query.page - 1) * 3 : 0}`, filterArr, (err, res) => {
      if (err) {
        return rs.status(500).send(err);
      }
      let data = res.rows;
      db.query(`SELECT COUNT(userid) AS total FROM (SELECT userid, email, firstname, lastname, position, fulltime, role FROM users ${filterQuery} ORDER BY ${sort.prop} ${sort.rule} ) as users`, filterArr, (err, res) => {
        if (err) {
          return rs.status(500).send(err);
        }
        let result = {
          data,
          page: parseInt(rq.query.page),
          total: res.rows[0] ? parseInt(res.rows[0].total) : 0
        }
        rs.render('users/list', { nav: 'users', query: url, sort, user: rq.session.user, result, option });
        rs.status(200);
      })
    })
  })

});

router.post('/option', (rq, rs) => {
  let data = rq.body;
  let userid = rq.session.user.userid;
  let option = []
  if (data.optionuserid) option.push('userid');
  if (data.optionemail) option.push('email')
  if (data.optionfirstname) option.push('firstname')
  if (data.optionlastname) option.push('lastname')
  if (data.optionposition) option.push('position')
  if (data.optionfulltime) option.push('fulltime')
  if (data.optionrole) option.push('role')
  db.query(`UPDATE users set useroption = $1
WHERE userid = $2`,
    [
      option,
      userid
    ], (err, res) => {
      if (err) {
        return rs.status(500).send(err);
      }
      rs.redirect('/users')
    })
})


/* GET users listing. */
router.get('/edit/:userid', helpers.isLoggedIn, function (req, rs, next) {
  db.query(`SELECT email, password, position , fulltime FROM users WHERE users.userid = $1`,
    [req.session.user.userid], (err, res) => {
      if (err) {
        return rs.status(500).send(err);
      }
      rs.render('profile/form', { nav: 'profile', user: req.session.user, profile: res.rows[0] });
      rs.status(200);
    })
});

router.get('/add', helpers.isLoggedIn, (rq, rs) => {
  rs.render('users/form', { nav: 'users', user: rq.session.user, form: 'add' });
})

router.post('/', (rq, rs) => {
  let data = rq.body;
  db.query(`INSERT INTO users(email, password, firstname, lastname, position, fulltime, role) values 
        ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`,
    [
      data.email,
      bcrypt.hashSync(data.password, saltRound),
      data.firstname,
      data.lastname,
      data.position,
      data.fulltime,
      data.role
    ], (err, res) => {

      rs.redirect('/users')
      rs.status(201);
    });
})


router.post('/edit/:userid', function (req, res, next) {
  let data = req.body;
  if (data.password.length !== 0) {
    db.query(`UPDATE users SET password = $1, position = $2, fulltime = $3 WHERE userid = $4`, [
      bcrypt.hashSync(data.password, saltRound),
      data.position,
      data.fulltime ? true : false,
      data.userid
    ], (err) => {
      if (err) {
        return rs.status(500).send(err);
      }
      res.redirect('/profile')
    })
  } else {
    res.redirect('/profile')
  }
})

router.get('/delete/:userid', (rq, rs) => {
  db.query(`DELETE FROM users WHERE userid = $1`,
    [
      rq.params.userid
    ], (err, res) => {
      if (err) {
        return rs.status(500).send(err);
      }
      rs.status(200);
      rs.redirect('/users')
    })
})

module.exports = router;
