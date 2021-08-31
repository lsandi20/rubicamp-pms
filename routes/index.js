var express = require('express');
var router = express.Router();
let db = require('../db');
const bcrypt = require('bcrypt');
/* GET home page. */
router.get('/', function (req, res, next) {
  if (req.session.user) {
    return res.redirect('/projects')
  }
  res.render('login', { loginmessage: req.flash('loginmessage') });
});

router.post('/auth', function (req, rs, next) {
  const { email, password } = req.body
  db.query(`SELECT * FROM users WHERE email = $1`, [email], (err, res) => {
    if (err) {
      return rs.status(500).send(err);
    }
    if (res.rows.length === 0) {
      req.flash('loginmessage', 'User not found')
      return rs.redirect('/');
    }
    let data = res.rows[0];
    if (bcrypt.compareSync(password, data.password)) {
      req.session.user = data;
      rs.redirect('/projects')
    } else {
      req.flash('loginmessage', 'Password not match')
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
