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
      usernameField: 'email', 
      passwordField: 'password', 
      passReqToCallback: true}, 
      function (req, email, password, done){
              if(!email || !password) {return done(null, false, req.flash('message', 'All fields are required.'))} //If user does not enter a field, tell user to do so
              con.query('SELECT * FROM users WHERE email = "' + email + '"', function(err, rows){ //Pull row from db into row,
                  console.log(err)
                  console.log(rows)
                  if (err) return done(req.flash('message', err))
                  if(!rows.length) { 
                      return done(null, false, req.flash('message', 'Invalid username.'))}
                  var dbPassword = rows[0].password
                  bcrypt.compare(password, dbPassword, function(err,res){
                    if (err) throw err
                    if(res) return done(null, rows[0])
                    else return done(null,false, req.flash('message', 'Invalid password.'))
                  }) 
                 
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
    res.render('index.ejs', { name: req.user.username, group:req.user.groupID, message: req.flash('message')})
})
app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render('login.ejs', {message: req.flash('message')})
})
app.post('/login', checkNotAuthenticated, 
passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true 
}), function(req, res, info){
  res.render('login.ejs', {message: req.flash('message')})
})
app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render('register.ejs', {message: req.flash('message')})
})

app.post('/register', checkNotAuthenticated, async (req,res) => {
    try {
      con.query('SELECT * FROM users where email = "'+ req.body.email +'"', async function(err, rows){
        console.log(err)
        console.log(rows)
        if (err) return done(req.flash('message', err))
        if (!rows.length){
      if(req.body.password == req.body.Cpassword) 
      hashedPassword = await bcrypt.hash(req.body.password, 10)
      else {
        req.flash('message', 'Passwords do not match')
      }
        let userData = {
            username: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            groupID:0
        }
        let sql = 'INSERT INTO users SET ?'
        let query = con.query(sql, userData, (err, result) => {
          if (err) throw err
          console.log("Data Entered!")
        })

        res.redirect('/login')
      }
       else {
        req.flash('message', 'Email is already in use.')
        res.redirect('/register')
    }
    })
    } catch {
        res.redirect('/register')
    }
})
app.get('/groups', checkAuthenticated, (req, res) => {
  res.render('groups.ejs', {message: req.flash('message'), group:req.user.groupID})
})

app.post('/groups', checkAuthenticated, async (req,res) => {
  try{
    let groupData = {
      groupName: req.body.groupname,
      groupPassword: req.body.grouppassword,
      groupMembers: ''
  }
        let sql = 'INSERT INTO groop SET ?'
        let query = con.query(sql, groupData, (err, result) => {
          if (err) throw err
          console.log("Data Entered!")
        })
    res.redirect('/groups')
  } catch {
    res.redirect('/')
  }
})

app.get('/tickets', checkAuthenticated, checkIfInGroup, (req, res) => {
  res.render('tickets.ejs', {message: req.flash('message')})
})

app.post('/tickets', checkAuthenticated, checkIfInGroup, async (req,res) => {
  try{
    var Datetime = req.body.dueTime
    var x = new Date(Datetime).getTime();
    let ticketData = {
      groupID: req.user.groupID,
      ticketName: req.body.ticketName,
      ticketDescription: req.body.ticketDesc,
      dueDate: x,
      createDate: Date.now(),
      userIDCreate: req.user.id
  }
  let sql = 'INSERT INTO tickets SET ?'
  let query = con.query(sql, ticketData , (err, result) => {
    if (err) throw err

  })
  req.flash('message', 'Ticket successfully saved to database.')
    res.redirect('/tickets')
  } catch {
    res.redirect('/')
  }
})

app.get('/joinGroup', checkAuthenticated, checkIfNotInGroup, (req, res) =>{
  res.render('joinGroup.ejs')
})


  app.post('/joinGroup', checkAuthenticated, checkIfNotInGroup, async (req,res,done) => {
    try{
    con.query("SELECT * FROM groop WHERE groupName = ?", [req.body.groupName1], function(err, rows){ //Pull row from db into row,
      console.log(err)
      console.log(rows)
      if (err) return done(req.flash('message', err))
      if(!rows.length) { 
          return done(null, false, req.flash('message', 'Invalid group name or password.'))}
      if(req.body.groupPassword1 !== rows[0].groupPassword){
        return done(null,false, req.flash('message', 'Invalid group name or password.'))
      }
      else {
        req.user.groupID = rows[0].id
        var x = rows[0].groupMembers + `${req.user.id}b`
        con.query(`UPDATE users SET groupID = ${rows[0].id} WHERE id = ${req.user.id}`)
        //con.query(`UPDATE groop SET groupMembers = ${x} WHERE id = ${rows[0].id}`)
        return done(null,rows[0])
      }
      //if (bcrypt.compare(password, dbPassword)) return done(null, rows[0])
      //else return done(null,false, req.flash('message', 'Invalid username or password.'))
    })
      res.redirect('/')
    } catch {
      res.redirect('/joinGroup')
    }
  })
  app.delete('/logout', (req, res) => {
    req.logOut()
    res.redirect('/login')
  })
  app.delete('/leavegroup', (req,res) => {
    con.query(`UPDATE users SET groupID = 0 WHERE id = ${req.user.id}`)
    req.flash('message', 'Successfully left group.')
    res.redirect('/')
  })
  function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
  
    res.redirect('/login')
  }
  function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect('/')
    }
    next()
  }

  function checkIfInGroup(req, res, next) {
    if (req.user.groupID !== 0) {
      return next()
    }
    req.flash('message','Please join a group.')
    res.redirect('/')
  }
  function checkIfNotInGroup(req, res, next) {
    if (req.user.groupID == 0) {
      return next()
    }
    req.flash('message', 'Please leave your group.')
    res.redirect('/')

  }

app.listen(80)