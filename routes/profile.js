var express = require('express');
var router = express.Router();
const helpers = require('../helpers/util');

/* GET users listing. */
router.get('/', helpers.isLoggedIn, function (req, res, next) {
  res.render('profile', { nav: 'profile', user: req.session.user });
  res.status(200);
});

module.exports = router;
