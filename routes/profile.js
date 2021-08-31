var express = require('express');
var router = express.Router();
const helpers = require('../helpers/util');
let db = require('../db');
const bcrypt = require('bcrypt');
const saltRound = 10;

/* GET users listing. */
router.get('/', helpers.isLoggedIn, function (req, rs, next) {
  db.query(`SELECT email, password, position , fulltime FROM users WHERE users.userid = $1`,
    [req.session.user.userid], (err, res) => {
      if (err) {
        return rs.status(500).send(err);
      }
      rs.render('profile/form', { nav: 'profile', user: req.session.user, profile: res.rows[0], breadmessage: req.flash('breadmessage') });
      rs.status(200);
    })
});

router.post('/', helpers.isLoggedIn, function (req, res, next) {
  let data = req.body;
  if (data.password.length !== 0) {
    db.query(`UPDATE users SET password = $1, position = $2, fulltime = $3 WHERE userid = $4`, [
      bcrypt.hashSync(data.password, saltRound),
      data.position,
      data.fulltime ? true : false,
      data.userid
    ], (err) => {
      if (err) {
        req.flash('breadmessage', 'Profil berhasil diubah')
        return rs.status(500).send(err);
      }
      res.redirect('/profile')
    })
  } else {
    db.query(`UPDATE users SET position = $1, fulltime = $2 WHERE userid = $3`, [
      data.position,
      data.fulltime ? true : false,
      data.userid
    ], (err) => {
      if (err) {
        return rs.status(500).send(err);
      }
      req.flash('breadmessage', 'Profil berhasil diubah')
      res.redirect('/profile')
    })
  }
})

module.exports = router;
