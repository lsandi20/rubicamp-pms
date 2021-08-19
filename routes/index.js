var express = require('express');
var router = express.Router();
let db = require('../db');
const bcrypt = require('bcrypt');
const saltRound = 10;
/* GET home page. */
router.get('/', function (req, res, next) {
  if (req.session.user) {
    return res.redirect('/projects')
  }
  res.render('login');
});

router.post('/auth', function (req, rs, next) {
  const { email, password } = req.body
  db.query(`SELECT * FROM users WHERE email = $1`, [email], (err, res) => {
    if (err || res.rows.length === 0) {
      rs.redirect('/');
    }
    let data = res.rows[0];
    if (bcrypt.compareSync(password, data.password)) {
      req.session.user = data;
      rs.redirect('/projects')
    } else {
      rs.redirect('/');
    }
  })
})

router.get('/logout', function (req, res, next) {
  req.session.destroy(() => {
    res.redirect('/');
  })
})

module.exports = router;
