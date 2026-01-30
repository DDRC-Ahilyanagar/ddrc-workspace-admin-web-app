const fs = require('fs');
const path = 'd:\\Projects\\ddrc-workspace\\ddrc-workspace-admin-web-app\\prisma\\questions.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const keywords = [
    'दिव्यांगता कारण', // Disability Reason
    'नोकरी', // Job
    'व्यवसाय', // Business
    'शासकीय योजना', // Govt Scheme
    'मनरेगा', // MNREGA
    'बँक', // Bank
    'निधी', // Fund
    'खेळ' // Sports
];

const found = data.filter(q => {
    return keywords.some(k => (q.question && q.question.includes(k)) || (q.title && q.title.includes(k)));
});

console.log(JSON.stringify(found.map(q => ({
    id: q.id,
    title: q.title,
    question: q.question,
    options: q.options,
    rendering: {
        condition: q.rendering_condition,
        question: q.rendering_question,
        value: q.rendering_value
    }
})), null, 2));
