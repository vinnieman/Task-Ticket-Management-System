var mysql = require('mysql')

const con = mysql.createConnection({
    host: "database-1.cx1uie41g3t5.us-west-1.rds.amazonaws.com",
    user: 'admin',
    password: "123456Vt#",
    database: "ttms"
  })

  module.exports = con