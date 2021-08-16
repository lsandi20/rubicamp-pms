var express = require('express');
const helpers = require('../helpers/util');
var router = express.Router();

/* GET users listing. */
router.get('/', helpers.isLoggedIn, function (req, res, next) {
  res.render('home', { nav: 'home', user: req.session.user });
  res.status(200);
});

module.exports = router;
