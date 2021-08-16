var express = require('express');
var router = express.Router();
let db = require('../db');
/* GET home page. */
router.get('/', function (req, res, next) {
  if (req.session.user) {
    return res.redirect('/home')
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
    if (data.password === password) {
      req.session.user = data;
      rs.redirect('/home')
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
