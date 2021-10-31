const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const mysql = require('mysql')


function initialize(passport, getUserByEmail,getUserById){
    passport.use('local', new LocalStrategy({
        usernameField: 'username', 
        passwordField: 'password', 
        passReqToCallback: true}, 
        function (req, username, password, done){
                if(!username || !password) {return done(null, false, req.flash('message', 'All fields are required.'))}
                con.query("SELECT * FROM users WHERE username = ?", [username], function(err, rows){
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
}

module.exports = initialize