const mysql=require('mysql2/promise');
require('dotenv').config();
(async()=>{
  const pool=mysql.createPool({
    host:process.env.DB_HOST||'localhost',
    user:process.env.DB_USER||'root',
    password:process.env.DB_PASSWORD||process.env.DB_PASS||'',
    database:process.env.DB_NAME||'ddrc_surveys'
  });
  try{
    const [c]=await pool.query('SELECT id,survey_id,question_id,verification_officer_id,field_officer_id,reason,status,created_at,updated_at FROM question_clarifications ORDER BY id DESC LIMIT 10');
    console.log('\nLATEST_CLARIFICATIONS='); console.table(c);
    const [n]=await pool.query("SELECT id,user_id,from_user_id,field_officer_id,type,title,is_read,created_at FROM notifications WHERE type IN ('clarification_request','clarification_resolved') ORDER BY id DESC LIMIT 20");
    console.log('\nLATEST_NOTIFICATIONS='); console.table(n);
    const [fcm]=await pool.query('SELECT id,user_id,LEFT(fcm_token,20) as token_prefix,created_at,updated_at FROM fcm_tokens ORDER BY id DESC LIMIT 20');
    console.log('\nLATEST_FCM_TOKENS='); console.table(fcm);
    const [u]=await pool.query('SELECT id,name,contact_number,user_type,status,is_active FROM users ORDER BY id DESC LIMIT 30');
    console.log('\nLATEST_USERS='); console.table(u);
  }catch(e){console.error('ERR',e.message);}finally{await pool.end();}
})();
