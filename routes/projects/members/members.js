var express = require('express');
const helpers = require('../../../helpers/util');
var router = express.Router();
const db = require('../../../db')

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

/* GET users listing. */
router.get('/:projectid', helpers.isLoggedIn, function (rq, rs, next) {
  db.query(`SELECT memberoption from users WHERE userid = ${rq.session.user.userid}`, (err, res) => {
    let option = { userid: false, name: false, position: false }
    if (res.rows[0].memberoption.length > 0) {
      res.rows[0].memberoption.forEach(el => {
        option[el] = true
      });
    }
    rs.render('projects/members/list', { nav: 'projects', side: 'members', projectid: rq.params.projectid, user: rq.session.user, option });
  })
})

module.exports = router;
