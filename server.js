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
app.use(express.urlencoded({extended: false}))
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
        if(err) throw err
        if(!rows.length) { 
          return done(null, false, req.flash('message', 'Invalid email address.'))}
          var dbPassword = rows[0].password
          bcrypt.compare(password, dbPassword, function(err,res){
            if (err) throw err
            if(res) return done(null, rows[0])
            else return done(null,false, req.flash('message', 'Invalid password.'))
            })    
          })
    }))
passport.serializeUser((user,done) => done(null,user.id))
passport.deserializeUser(function(id, done) {
  con.query('select * from users where id = "'+id +'"',function(err,rows){	
    done(err, rows[0])
  })
})

app.use(methodOverride('_method'))
app.use('/public', express.static('public'))

//Webpages
app.get('/', checkAuthenticated, (req, res) => {
  con.query('SELECT groupName FROM groop WHERE id = "' + req.user.groupID + '"', function(err, rows){ //Pull row from db into row,
    if (err) throw err
    var gn = rows
    con.query('SELECT username, id FROM users WHERE groupID = "' + req.user.groupID + '"', function(err, rows1){ //Pull row from db into row,
      if (err) throw err
      var gm = rows1
      //console.log(groupData)
      if(req.user.groupID == 0){
        gm = []
        gn = []
      }
      res.render('index.ejs', {message: req.flash('message'), group:req.user.groupID, groupInfo: gn, groupMembers: gm, name: req.user.username, email: req.user.email})
      })
    })
})
app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs', {message: req.flash('message')})
})
//Login function
app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true }), 
  function(req, res){
    res.render('login.ejs', {message: req.flash('message')})
})
app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register.ejs', {message: req.flash('message')})
})
//Register function
app.post('/register', checkNotAuthenticated, async (req,res) => {
  try {
    con.query('SELECT * FROM users WHERE email = "'+ req.body.email +'"', async function(err, rows, done){
      if(err) throw err
      if (!rows.length){
        if(req.body.password == req.body.Cpassword) var hashedPassword = await bcrypt.hash(req.body.password, 10)
        else req.flash('message', 'Passwords do not match')
        let userData = {
          username: req.body.name,
          email: req.body.email,
          password: hashedPassword,
          groupID:0
      } 
      let sql = 'INSERT INTO users SET ?'
      con.query(sql, userData, (err) => {
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
//Join group function
app.post('/groups', checkAuthenticated, (req,res) => {
try{
  con.query('SELECT * FROM groop where groupName = "'+ req.body.groupname +'"', async function(err, rows){
    if(err) throw err
  if(!rows.length){
    let groupData = {
      groupName: req.body.groupname,
      groupPassword: req.body.grouppassword,
      groupMembers: ''
    }
    let sql = 'INSERT INTO groop SET ?'
    con.query(sql, groupData, (err, result) => {
      if (err) throw err
      console.log("Data Entered!")
    })  
    req.flash('message', 'Project created.')
    res.redirect('/')
    }
    else {
      req.flash('message', 'Project Name already in use.')
      res.redirect('/')   
      }
    })
  } catch {
  res.redirect('/')
}
})

app.get('/tickets', checkAuthenticated, checkIfInGroup, (req, res) => {
  con.query('SELECT username, id FROM users WHERE groupID = "' + req.user.groupID + '"', function(err, rows){ //Pull row from db into row,
    if (err) throw err
    gm = rows
    con.query('SELECT * FROM tickets WHERE groupID = "' + req.user.groupID + '"AND userIDCreate = "' +req.user.id + '"', function(err, rows){ //Pull row from db into row,
      if (err) throw err
      tD = rows
      con.query('SELECT * FROM tickets WHERE userIDAssign = "' + req.user.id + '"', function(err, rows){ //Pull row from db into row,
        if (err) throw err
        aTD = rows
        res.render('tickets.ejs', {ticketInfo: tD, ticketInfo2: aTD, groupMembers:gm, message: req.flash('message'), name: req.user.username, email: req.user.email})
        })
      })
    })

})
//Create ticket function
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
    userIDCreate: req.user.id,
    ticketstatus: 0
} 
let sql = 'INSERT INTO tickets SET ?'
con.query(sql,ticketData , (err) => {
  if (err) throw err
})
  req.flash('message', 'Ticket successfully saved to database.')
  res.redirect('/tickets')
} catch {
    res.redirect('/')
  }
})
app.post('/ticketassign', checkAuthenticated, checkIfInGroup, async (req,res) => {
  try{
    con.query('SELECT id FROM users WHERE username = "'+ req.body.GroupM +'"AND groupID = "' + req.user.groupID +'"', function(err,rows){
    if (err) throw err
     con.query('UPDATE tickets SET userIDAssign = "' + rows[0].id +'", ticketstatus = 1 WHERE id = "'+ req.body.ticketA +'"') 
    })
    
    res.redirect('/tickets')
  } catch {
      res.redirect('/')
    }
  })
  app.post('/ticketcomplete', checkAuthenticated, checkIfInGroup, async (req,res) => {
    try{
      con.query('UPDATE tickets SET ticketstatus = 2, userIDAssign = NULL WHERE id = "'+ req.body.ticketC +'"') 
      res.redirect('/tickets')
    } catch {
        res.redirect('/')
      }
    })
    app.post('/ticketdelete', checkAuthenticated, checkIfInGroup, async (req,res) => {
      try{
        con.query('DELETE FROM tickets WHERE id = "'+ req.body.ticketD +'"',  function(err, rows){
          if(err)throw(err)
             else {
              req.flash('message', 'Ticket deleted.')
              res.redirect('/tickets') 
             }})
      } catch {
          res.redirect('/')
        }
      })
app.post('/joinGroup', checkAuthenticated, checkIfNotInGroup, async (req,res,done) => {
  try{
    con.query('SELECT * FROM groop WHERE groupName = "'+ req.body.groupName1+ '"', function(err, rows){ //Pull row from db into row,
      if (err) throw err
      if(!rows.length) { 
        return done(null, false, req.flash('message', 'Invalid project name or password.'))}
      if(req.body.groupPassword1 !== rows[0].groupPassword){
        return done(null,false, req.flash('message', 'Invalid project name or password.'))
    }
      else {
        req.user.groupID = rows[0].id
        con.query('UPDATE users SET groupID = "'+ rows[0].id +'" WHERE id = "'+ req.user.id +'"')
        return done(null,rows[0])
      }
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
  con.query('UPDATE users SET groupID = 0 WHERE id = "'+req.user.id+'"')
  req.flash('message', 'Successfully left project.')
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
  req.flash('message','Please join a project.')
  res.redirect('/')
}
function checkIfNotInGroup(req, res, next) {
  if (req.user.groupID == 0) {
    return next()
  }
  req.flash('message', 'Please leave your project.')
  res.redirect('/')
}
app.listen(80)