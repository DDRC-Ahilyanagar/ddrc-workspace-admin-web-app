const mysql=require('mysql2/promise');
require('dotenv').config();
(async()=>{
  const pool=mysql.createPool({host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||process.env.DB_PASS||'',database:process.env.DB_NAME||'ddrc_surveys'});
  try{
    const [cols]=await pool.query("SHOW COLUMNS FROM notifications");
    console.log('\nNOTIFICATIONS_COLUMNS='); console.table(cols.map(c=>({Field:c.Field,Type:c.Type,Null:c.Null,Key:c.Key})));
    const [n]=await pool.query('SELECT * FROM notifications ORDER BY id DESC LIMIT 20');
    console.log('\nLATEST_NOTIFICATIONS_ROWS='); console.table(n);
    const [fcm]=await pool.query('SELECT id,user_id,LEFT(fcm_token,20) as token_prefix,created_at,updated_at FROM fcm_tokens ORDER BY id DESC LIMIT 20');
    console.log('\nLATEST_FCM_TOKENS='); console.table(fcm);
    const [u]=await pool.query('SELECT id,name,contact_number,user_type,status,is_active FROM users WHERE id IN (27,28) ORDER BY id');
    console.log('\nKEY_USERS_27_28='); console.table(u);
  }catch(e){console.error('ERR',e.message);}finally{await pool.end();}
})();
