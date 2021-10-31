if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
  }
//dependencies
const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const mysql = require('mysql')
const LocalStrategy = require('passport-local').Strategy
const con = require('./rdsconn')

//test if connection succeeds
con.connect(function(err){
  if (err) throw err
  console.log("Connected!")
  });

// last array left. will delete once tickets are fully done
const tickets = []

app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false}))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUnitialized: false
}))
// setup passport
app.use(passport.initialize())
app.use(passport.session())
  passport.use('local', new LocalStrategy({
      usernameField: 'username', 
      passwordField: 'password', 
      passReqToCallback: true}, 
      function (req, username, password, done){
              if(!username || !password) {return done(null, false, req.flash('message', 'All fields are required.'))} //If user does not enter a field, tell user to do so
              con.query("SELECT * FROM users WHERE username = ?", [username], function(err, rows){ //Pull row from db into row,
                  console.log(err)
                  console.log(rows)
                  if (err) return done(req.flash('message', err))
                  if(!rows.length) { 
                      return done(null, false, req.flash('message', 'Invalid username or password.'))}
                  var dbPassword = rows[0].password
                  if (bcrypt.compare(password, dbPassword)) return done(null, rows[0])
                  else return done(null,false, req.flash('message', 'Invalid username or password.'))
              })
      }
  )
  )
  passport.serializeUser((user,done) => done(null,user.id))
  passport.deserializeUser(function(id, done) {
  con.query("select * from users where id = "+id,function(err,rows){	
    done(err, rows[0]);
  });
  });

app.use(methodOverride('_method'))
app.use('/public', express.static('public'))





//Webpages
app.get('/', checkAuthenticated, (req, res) => {
    res.render('index.ejs', { name: req.user.username, group:req.user.groupName})
})
app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render('login.ejs')
})
app.post('/login', checkNotAuthenticated, 
passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true 
}), function(req, res, info){
  res.render('login.ejs', {'message': req.flash('message')})
})
app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render('register.ejs')
})

app.post('/register', checkNotAuthenticated, async (req,res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        let userData = {
            username: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            groupName:''
        }
        let sql = 'INSERT INTO users SET ?'
        let query = con.query(sql, userData, (err, result) => {
          if (err) throw err
          console.log("Data Entered!")
        })

        res.redirect('/login')
    } catch {
        res.redirect('/register')
    }
})
app.get('/groups', (req, res) => {
  res.render('groups.ejs')
})

app.post('/groups', async (req,res) => {
  try{
        let groupData = {
            groupName: req.body.groupName,
            groupPassword: groupPassword,
        }
        let sql = 'INSERT INTO groups SET ?'
        let query = con.query(sql, groupData, (err, result) => {
          if (err) throw err
          console.log("Data Entered!")
        })
    res.redirect('/groups')
  } catch {
    res.redirect('/')
  }
})

app.get('/tickets', (req, res) => {
  res.render('tickets.ejs',{ tickets: tickets})
})

app.post('/tickets', async (req,res) => {
  try{
    let ticketData = {
      ticketName: req.body.ticketName,
      ticketDescription: req.body.ticketDesc,
      dueDate: req.body.dueTime,
      createDate: Date.now().toString(),
      userIDCreate: req.user.name
  }
  let sql = 'INSERT INTO tickets SET ?'
  let query = con.query(sql, ticketData, (err, result) => {
    if (err) throw err
    console.log("Data Entered!")
  })
    res.redirect('/tickets')
  } catch {
    res.redirect('/')
  }
  console.log(tickets)
})
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
  
    res.redirect('/login')
  }
  app.delete('/logout', (req, res) => {
    req.logOut()
    res.redirect('/login')
  })
  function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect('/')
    }
    next()
  }
  


app.listen(3100)