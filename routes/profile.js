var express = require('express');
var router = express.Router();
const helpers = require('../helpers/util');
let db = require('../db');

/* GET users listing. */
router.get('/', helpers.isLoggedIn, function (req, rs, next) {
  db.query(`SELECT email, password, role , fulltime FROM users 
  INNER JOIN members ON users.userid = members.userid WHERE users.userid = $1`,
    [req.session.user.userid], (err, res) => {
      rs.render('profile', { nav: 'profile', user: req.session.user, profile: res.rows[0] });
      rs.status(200);
    })
});

router.post('/', function (req, res, next) {
  let data = req.body;
  db.query(`UPDATE members SET role = $1, fulltime = $2 WHERE userid = $3`, [
    data.position,
    data.fulltime ? true : false,
    data.userid
  ], (err) => {
    if (data.password.length !== 0) {
      db.query(`UPDATE users SET password = $1 WHERE userid = $2`, [
        data.password,
        data.userid
      ], (err) => {
        res.redirect('/profile')
      })
    } else {
      res.redirect('/profile')
    }
  })
})

module.exports = router;
