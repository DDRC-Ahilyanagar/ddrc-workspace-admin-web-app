const mysql=require('mysql2/promise');
require('dotenv').config();
(async()=>{
  const pool=mysql.createPool({host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||process.env.DB_PASS||'',database:process.env.DB_NAME||'ddrc_surveys'});
  const surveyIdParam=93;
  try{
    const conn=await pool.getConnection();
    const [surveyRows]=await conn.query(`SELECT s.id, s.user_id, s.assigned_to, s.aadhaar_id, sa.user_id AS aadhar_user_id, sa.holder_name, sa.aadhar_no FROM surveys s LEFT JOIN survey_aadhar sa ON sa.id = s.aadhaar_id WHERE s.id = ? OR s.aadhaar_id = ? LIMIT 1`,[surveyIdParam,surveyIdParam]);
    console.log('SURVEY=',surveyRows[0]);
    const survey=surveyRows[0];
    const [assignmentRows]=await conn.query(`SELECT field_officer_id FROM survey_assignments WHERE survey_id = ? ORDER BY assigned_at DESC LIMIT 1`,[survey.id]);
    let fieldOfficerId=(assignmentRows[0]&&assignmentRows[0].field_officer_id)||survey.user_id||survey.aadhar_user_id;
    console.log('FIELD_OFFICER_ID=',fieldOfficerId,'ASSIGN_ROW=',assignmentRows[0]);
    const [fieldOfficerRows]=await conn.query(`SELECT id,name,email,contact_number,user_type FROM users WHERE id=? LIMIT 1`,[fieldOfficerId]);
    console.log('FIELD_OFFICER_ROW=',fieldOfficerRows[0]);
    const holderName=survey.holder_name||'Unknown';
    const title=`${holderName} ?? ??????? ?????`;
    const message=`1 ?????? ??????? ????? ??. ??? ?????? ???? ??.`;
    const data=JSON.stringify({survey_id:String(survey.id),survey_aadhar_id:String(survey.aadhaar_id),holder_name:holderName,aadhar_no:survey.aadhar_no||'N/A',question_ids:[2],questions:[{question_id:'2',question_text:'??? ???',reason:'incorrect'}]});
    const [ins]=await conn.query(`INSERT INTO notifications (user_id, from_user_id, field_officer_id, type, title, message, data, is_read) VALUES (?, ?, ?, 'clarification_request', ?, ?, ?, 0)`,[fieldOfficerId,28,fieldOfficerId,title,message,data]);
    console.log('INSERT_OK_ID=',ins.insertId);
    await conn.query('DELETE FROM notifications WHERE id=?',[ins.insertId]);
    console.log('ROLLBACK_SIM=deleted test row');
    conn.release();
  }catch(e){console.error('ERR',e.message);}finally{await pool.end();}
})();
