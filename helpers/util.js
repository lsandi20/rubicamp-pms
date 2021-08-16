module.exports = {
  isLoggedIn: (req, res, next) => {
    if (req.session.user) {
      next()
    }
    res.redirect('/')
  }
}