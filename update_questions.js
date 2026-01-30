const fs = require('fs');
const path = 'd:\\Projects\\ddrc-workspace\\ddrc-workspace-admin-web-app\\prisma\\questions.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// 1. Update ID 72
const q72 = data.find(q => q.id === '72');
if (q72) {
    q72.options = 'जन्मत:,अपघात,वांशिक,अनुवांशिक,आजाराने';
}

// 2. Add New Questions
const newQuestions = [
    {
        "id": "221",
        "title": "शैक्षणिक माहिती",
        "question": "शिक्षण क्षेत्रात प्रवेश घेण्यासाठी ५% राखीव जागांचा लाभ घेतला आहे का ?",
        "question_type": "MCQ",
        "multi_select": "No",
        "options": "होय,नाही",
        "rendering_condition": "Yes",
        "rendering_question": "शिक्षित असल्यास / शिक्षण घेत असल्यास",
        "rendering_value": "पदवीधर,डिप्लोमा,डॉक्टरेट",
        "status": "Active",
        "created_by": "1",
        "created_on": "2026-01-30 15:30:00",
        "updated_by": null,
        "updated_on": null,
        "regex": "",
        "valid_input": "",
        "max_length": 10
    },
    {
        "id": "222",
        "title": "शैक्षणिक माहिती",
        "question": "खेळातील नैपुण्य स्तर",
        "question_type": "MCQ",
        "multi_select": "No",
        "options": "जिल्हास्तर,राज्यस्तर,राष्ट्रीय,आंतरराष्ट्रीय",
        "rendering_condition": "Yes",
        "rendering_question": "आपण खेळात नैपुण्य मिळविले आहे का?",
        "rendering_value": "होय",
        "status": "Active",
        "created_by": "1",
        "created_on": "2026-01-30 15:30:00",
        "updated_by": null,
        "updated_on": null,
        "regex": "",
        "valid_input": "",
        "max_length": 10
    },
    {
        "id": "223",
        "title": "नोकरी / व्यवसाय",
        "question": "नोकरीचे स्वरूप",
        "question_type": "MCQ",
        "multi_select": "No",
        "options": "कायम,कंत्राटी,मानधन तत्वावर,रोजंदारि तत्वावर",
        "rendering_condition": "Yes",
        "rendering_question": "नोकरी किंवा व्यवसाय करता का?",
        "rendering_value": "नोकरी",
        "status": "Active",
        "created_by": "1",
        "created_on": "2026-01-30 15:30:00",
        "updated_by": null,
        "updated_on": null,
        "regex": "",
        "valid_input": "",
        "max_length": 10
    },
    {
        "id": "224",
        "title": "नोकरी / व्यवसाय",
        "question": "नोकरीसाठी ४% राखीव जागांचा लाभ घेतला आहे का ?",
        "question_type": "MCQ",
        "multi_select": "No",
        "options": "होय,नाही",
        "rendering_condition": "Yes",
        "rendering_question": "नोकरी करत असल्यास",
        "rendering_value": "सरकारी",
        "status": "Active",
        "created_by": "1",
        "created_on": "2026-01-30 15:30:00",
        "updated_by": null,
        "updated_on": null,
        "regex": "",
        "valid_input": "",
        "max_length": 10
    },
    {
        "id": "225",
        "title": "नोकरी / व्यवसाय",
        "question": "कुटुंब पूर्णपणे दिव्यांग व्यक्तीच्या उत्पन्नावर अवलंबून आहे का ?",
        "question_type": "MCQ",
        "multi_select": "No",
        "options": "होय,नाही",
        "rendering_condition": "No",
        "rendering_question": null,
        "rendering_value": null,
        "status": "Active",
        "created_by": "1",
        "created_on": "2026-01-30 15:30:00",
        "updated_by": null,
        "updated_on": null,
        "regex": "",
        "valid_input": "",
        "max_length": 10
    },
    {
        "id": "226",
        "title": "इतर शासकीय योजना",
        "question": "दिव्यांग व्यक्तीला मनरेगा योजनेत रोजगार मिळाला आहे का?",
        "question_type": "MCQ",
        "multi_select": "No",
        "options": "होय,नाही",
        "rendering_condition": "No",
        "rendering_question": null,
        "rendering_value": null,
        "status": "Active",
        "created_by": "1",
        "created_on": "2026-01-30 15:30:00",
        "updated_by": null,
        "updated_on": null,
        "regex": "",
        "valid_input": "",
        "max_length": 10
    },
    {
        "id": "227",
        "title": "इतर शासकीय योजना",
        "question": "राष्ट्रीय कृत बँकेत खाते आहे का?",
        "question_type": "MCQ",
        "multi_select": "No",
        "options": "होय,नाही",
        "rendering_condition": "No",
        "rendering_question": null,
        "rendering_value": null,
        "status": "Active",
        "created_by": "1",
        "created_on": "2026-01-30 15:30:00",
        "updated_by": null,
        "updated_on": null,
        "regex": "",
        "valid_input": "",
        "max_length": 10
    },
    {
        "id": "228",
        "title": "इतर शासकीय योजना",
        "question": "दिव्यांगासाठी राखीव ५% निधी अंतर्गत लाभ घेतला आहे का ?",
        "question_type": "MCQ",
        "multi_select": "No",
        "options": "होय,नाही",
        "rendering_condition": "No",
        "rendering_question": null,
        "rendering_value": null,
        "status": "Active",
        "created_by": "1",
        "created_on": "2026-01-30 15:30:00",
        "updated_by": null,
        "updated_on": null,
        "regex": "",
        "valid_input": "",
        "max_length": 10
    },
    {
        "id": "229",
        "title": "इतर शासकीय योजना",
        "question": "वितरण विभाग (५% निधी अंतर्गत)",
        "question_type": "MCQ",
        "multi_select": "No",
        "options": "ग्रा. पं,पं स,न. पा,मनपा,जिल्हा परिषद",
        "rendering_condition": "Yes",
        "rendering_question": "दिव्यांगासाठी राखीव ५% निधी अंतर्गत लाभ घेतला आहे का ?",
        "rendering_value": "होय",
        "status": "Active",
        "created_by": "1",
        "created_on": "2026-01-30 15:30:00",
        "updated_by": null,
        "updated_on": null,
        "regex": "",
        "valid_input": "",
        "max_length": 10
    }
];

data.push(...newQuestions);

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Successfully updated questions.json');
