var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.render('profile', { nav: 'profile' });
  res.status(200);
});

module.exports = router;
