'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAbsoluteImageUrl } from '@/lib/config';

const LOGO_URL = getAbsoluteImageUrl('/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png');

// Translations object
const translations = {
  en: {
    nav: {
      publicSurvey: 'Public Survey',
      login: 'Login',
    },
    carousel: [
      {
        title: 'District Disability Rehabilitation Centre, Ahilyanagar',
        description: 'Ministry of Social Justice & Empowerment, Govt. of India approved',
      },
      {
        title: 'Secure & Encrypted Data Collection',
        description: 'Your sensitive information is protected with industry-standard encryption',
      },
      {
        title: 'Multi-Role Workflow System',
        description: 'Streamlined process from data collection to verification and approval',
      },
    ],
    carouselActions: {
      startSurvey: 'Start Survey',
    },
    download: {
      title: 'Download Mobile App',
      subtitle: 'Available on Google Play Store',
      forFieldOfficers: 'For Field Officers',
      description: 'If you are a field officer, download our mobile app from the Google Play Store to collect survey data efficiently on the go. The app works offline and syncs automatically when connected.',
      features: {
        offline: 'Offline data collection',
        ocr: 'OCR-based data extraction',
        sync: 'Real-time synchronization',
      },
      comingSoon: 'Coming soon on Google Play Store',
    },
    about: {
      title: 'About Disability Surveys',
      text1: 'The DDRC Survey Portal is a comprehensive digital platform designed to collect, manage, and process disability-related information for the District Disability Rehabilitation Centre, Ahilyanagar. This system enables efficient data collection through multiple channels and ensures secure handling of sensitive personal information.',
      text2: 'Our survey system captures detailed information including personal details, address information, education background, disability specifics, employment status, and various government scheme benefits. The platform uses advanced OCR (Optical Character Recognition) technology to automatically extract and pre-fill information from Aadhar cards and UDID certificates, reducing data entry time and minimizing errors.',
      features: {
        multiSection: 'Multi-section comprehensive data collection',
        ocr: 'OCR-based automatic data extraction',
        offline: 'Offline data collection capability',
        sync: 'Real-time data synchronization',
      },
    },
    roles: {
      title: 'User Roles & Responsibilities',
      subtitle: 'Each user role has specific responsibilities in the survey workflow',
      fieldOfficer: {
        title: 'Field Officer',
        responsibilities: [
          'Capture survey data using mobile application',
          'Collect Aadhar card images and personal information',
          'Verify beneficiary information on-site',
          'Upload survey data to the system',
          'Ensure data accuracy and completeness',
          'Work in offline mode when connectivity is limited',
        ],
      },
      verificationOfficer: {
        title: 'Verification Officer',
        responsibilities: [
          'Review surveys assigned by administrators',
          'Verify data accuracy and completeness',
          'Edit survey data based on admin corrections',
          'Mark surveys as verified after review',
          'Ensure compliance with data standards',
          'Handle clarification requests from beneficiaries',
        ],
      },
      administrator: {
        title: 'Administrator',
        responsibilities: [
          'Oversee entire survey workflow',
          'Review and add correction suggestions to surveys',
          'Assign surveys to verification officers',
          'Approve verified surveys',
          'Manage user accounts and permissions',
          'Generate reports and analytics',
          'Monitor system performance and data quality',
        ],
      },
      beneficiary: {
        title: 'Public User / Beneficiary',
        responsibilities: [
          'Access public survey form via web portal',
          'Submit personal information and documents',
          'Upload Aadhar card images',
          'Review submitted information',
          'Track survey status',
          'Respond to clarification requests if needed',
        ],
      },
    },
    process: {
      title: 'Survey Process Phases',
      subtitle: 'End-to-end workflow from data collection to final approval',
      steps: [
        {
          title: 'Data Collection',
          subtitle: 'Data Collection',
          description: 'Field officers or public users collect comprehensive disability-related information including personal details, address, education, disability specifics, and supporting documents. Data can be collected via mobile app or web portal.',
        },
        {
          title: 'Initial Submission',
          subtitle: 'Initial Submission',
          description: 'Collected survey data is submitted to the system with status "pending". The system automatically processes uploaded documents using OCR technology to extract relevant information and pre-fill form fields.',
        },
        {
          title: 'Admin Review',
          subtitle: 'Admin Review',
          description: 'Administrators review submitted surveys, check data quality, and add correction suggestions if needed. Surveys can be assigned to verification officers for detailed review. Status changes to "under_review".',
        },
        {
          title: 'Verification',
          subtitle: 'Verification',
          description: 'Verification officers review assigned surveys, verify data accuracy, make necessary corrections based on admin suggestions, and mark surveys as "verified" after thorough review and validation.',
        },
        {
          title: 'Final Approval',
          subtitle: 'Final Approval',
          description: 'Administrators review verified surveys and provide final approval. Once approved, surveys are marked as "approved" and become part of the official database. Approved surveys can be used for generating certificates and accessing government schemes.',
        },
      ],
    },
    security: {
      title: 'Data Security & Encryption',
      intro: 'Your sensitive information is our top priority. We understand that disability-related data contains highly sensitive personal information, and we have implemented multiple layers of security to protect your data.',
      features: {
        encryption: {
          title: 'End-to-End Encryption',
          description: 'All data transmitted between your device and our servers is encrypted using industry-standard TLS/SSL protocols. This ensures that your information cannot be intercepted or read during transmission.',
        },
        database: {
          title: 'Database Encryption',
          description: 'Sensitive data stored in our databases is encrypted at rest using AES-256 encryption, the same standard used by banks and government agencies. This means your data is protected even if physical access to servers is gained.',
        },
        access: {
          title: 'Role-Based Access Control',
          description: 'Access to sensitive data is strictly controlled through role-based permissions. Only authorized personnel with specific roles can access, view, or modify data relevant to their responsibilities.',
        },
        storage: {
          title: 'Secure File Storage',
          description: 'Uploaded documents such as Aadhar cards and certificates are stored in encrypted storage with restricted access. Files are only accessible to authorized personnel during the verification process.',
        },
        audit: {
          title: 'Audit Logging',
          description: 'All data access and modifications are logged with timestamps and user information. This creates a complete audit trail for compliance and security monitoring purposes.',
        },
        updates: {
          title: 'Regular Security Updates',
          description: 'Our security infrastructure is regularly updated to protect against emerging threats. We follow industry best practices and comply with government data protection guidelines.',
        },
      },
      privacy: 'Privacy Commitment: Your personal information is used solely for the purpose of providing disability rehabilitation services. Data is never shared with third-party commercial entities or used for marketing purposes. All data handling complies with government regulations and privacy laws.',
    },
    cta: {
      title: 'Ready to Get Started?',
      text: 'Join us in our mission to empower persons with disabilities. Access our services or participate in our comprehensive survey program.',
      startSurvey: 'Start Public Survey',
    },
    footer: {
      title: 'DDRC Ahilyanagar',
      description: 'District Disability Rehabilitation Centre, Ahilyanagar\nMinistry of Social Justice & Empowerment, Govt. of India',
      quickLinks: 'Quick Links',
      contact: 'Contact',
      address: 'District Disability Rehabilitation Centre\nAhilyanagar, Maharashtra, India',
      poweredBy: 'Powered by',
      copyright: 'DDRC Ahilyanagar. All rights reserved.',
    },
  },
  mr: {
    nav: {
      publicSurvey: 'सार्वजनिक सर्वेक्षण',
      login: 'लॉगिन',
    },
    carousel: [
      {
        title: 'जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर',
        description: 'सामाजिक न्याय आणि सक्षमीकरण मंत्रालय, भारत सरकार मान्यताप्राप्त',
      },
      {
        title: 'सुरक्षित आणि एन्क्रिप्टेड डेटा संकलन',
        description: 'तुमची संवेदनशील माहिती उद्योग-मानक एन्क्रिप्शनसह संरक्षित आहे',
      },
      {
        title: 'बहु-भूमिका कार्यप्रवाह प्रणाली',
        description: 'डेटा संकलनापासून पडताळणी आणि मंजुरीपर्यंत सुव्यवस्थित प्रक्रिया',
      },
    ],
    carouselActions: {
      startSurvey: 'सर्वेक्षण सुरू करा',
    },
    download: {
      title: 'मोबाइल ऍप डाउनलोड करा',
      subtitle: 'गूगल प्ले स्टोअरवर उपलब्ध',
      forFieldOfficers: 'क्षेत्र अधिकारींसाठी',
      description: 'जर तुम्ही क्षेत्र अधिकारी आहात, तर गूगल प्ले स्टोअरवरून आमचा मोबाइल ऍप डाउनलोड करा जेणेकरून तुम्ही सर्वेक्षण डेटा कार्यक्षमतेने गोळा करू शकता. ऍप ऑफलाइन कार्य करते आणि कनेक्ट झाल्यावर स्वयंचलितपणे सिंक होते.',
      features: {
        offline: 'ऑफलाइन डेटा संकलन',
        ocr: 'OCR-आधारित डेटा निष्कर्षण',
        sync: 'वास्तविक-वेळ सिंक्रोनायझेशन',
      },
      comingSoon: 'लवकरच गूगल प्ले स्टोअरवर येणार आहे',
    },
    about: {
      title: 'दिव्यांग सर्वेक्षणाबद्दल',
      text1: 'DDRC सर्वेक्षण पोर्टल हे जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगरसाठी दिव्यांग-संबंधित माहिती गोळा करण्यासाठी, व्यवस्थापित करण्यासाठी आणि प्रक्रिया करण्यासाठी डिझाइन केलेले एक व्यापक डिजिटल प्लॅटफॉर्म आहे. ही प्रणाली अनेक चॅनेलद्वारे कार्यक्षम डेटा संकलन सक्षम करते आणि संवेदनशील वैयक्तिक माहितीचे सुरक्षित हाताळणी सुनिश्चित करते.',
      text2: 'आमची सर्वेक्षण प्रणाली वैयक्तिक तपशील, पत्ता माहिती, शैक्षणिक पार्श्वभूमी, दिव्यांग तपशील, रोजगार स्थिती आणि विविध सरकारी योजना लाभ यासह तपशीलवार माहिती कॅप्चर करते. प्लॅटफॉर्म आधार कार्ड आणि UDID प्रमाणपत्रांमधून माहिती स्वयंचलितपणे काढण्यासाठी आणि फॉर्म फील्ड पूर्व-भरण्यासाठी प्रगत OCR (ऑप्टिकल कॅरेक्टर रिकग्निशन) तंत्रज्ञान वापरते, डेटा प्रवेश वेळ कमी करते आणि त्रुटी कमी करते.',
      features: {
        multiSection: 'बहु-विभाग व्यापक डेटा संकलन',
        ocr: 'OCR-आधारित स्वयंचलित डेटा निष्कर्षण',
        offline: 'ऑफलाइन डेटा संकलन क्षमता',
        sync: 'वास्तविक-वेळ डेटा सिंक्रोनायझेशन',
      },
    },
    roles: {
      title: 'वापरकर्ता भूमिका आणि जबाबदाऱ्या',
      subtitle: 'सर्वेक्षण कार्यप्रवाहात प्रत्येक वापरकर्ता भूमिकेची विशिष्ट जबाबदारी असते',
      fieldOfficer: {
        title: 'क्षेत्र अधिकारी',
        responsibilities: [
          'मोबाइल अनुप्रयोग वापरून सर्वेक्षण डेटा कॅप्चर करा',
          'आधार कार्ड प्रतिमा आणि वैयक्तिक माहिती गोळा करा',
          'साइटवर लाभार्थी माहिती सत्यापित करा',
          'सिस्टममध्ये सर्वेक्षण डेटा अपलोड करा',
          'डेटा अचूकता आणि पूर्णता सुनिश्चित करा',
          'कनेक्टिव्हिटी मर्यादित असताना ऑफलाइन मोडमध्ये कार्य करा',
        ],
      },
      verificationOfficer: {
        title: 'पडताळणी अधिकारी',
        responsibilities: [
          'प्रशासकांद्वारे नियुक्त केलेल्या सर्वेक्षणांचे पुनरावलोकन करा',
          'डेटा अचूकता आणि पूर्णता सत्यापित करा',
          'प्रशासकीय सुधारणांवर आधारित सर्वेक्षण डेटा संपादित करा',
          'पुनरावलोकनानंतर सर्वेक्षणे सत्यापित म्हणून चिन्हांकित करा',
          'डेटा मानकांचे अनुपालन सुनिश्चित करा',
          'लाभार्थ्यांकडून स्पष्टीकरण विनंत्या हाताळा',
        ],
      },
      administrator: {
        title: 'प्रशासक',
        responsibilities: [
          'संपूर्ण सर्वेक्षण कार्यप्रवाहाचे पर्यवेक्षण करा',
          'सर्वेक्षणांचे पुनरावलोकन करा आणि सुधारणा सूचना जोडा',
          'पडताळणी अधिकाऱ्यांना सर्वेक्षणे नियुक्त करा',
          'सत्यापित सर्वेक्षणे मंजूर करा',
          'वापरकर्ता खाती आणि परवानग्या व्यवस्थापित करा',
          'अहवाल आणि विश्लेषण तयार करा',
          'सिस्टम कार्यप्रदर्शन आणि डेटा गुणवत्ता निरीक्षण करा',
        ],
      },
      beneficiary: {
        title: 'सार्वजनिक वापरकर्ता / लाभार्थी',
        responsibilities: [
          'वेब पोर्टलद्वारे सार्वजनिक सर्वेक्षण फॉर्ममध्ये प्रवेश करा',
          'वैयक्तिक माहिती आणि दस्तऐवज सबमिट करा',
          'आधार कार्ड प्रतिमा अपलोड करा',
          'सबमिट केलेली माहिती पुनरावलोकन करा',
          'सर्वेक्षण स्थिती ट्रॅक करा',
          'आवश्यक असल्यास स्पष्टीकरण विनंत्या उत्तर द्या',
        ],
      },
    },
    process: {
      title: 'सर्वेक्षण प्रक्रिया टप्पे',
      subtitle: 'डेटा संकलनापासून अंतिम मंजुरीपर्यंत संपूर्ण कार्यप्रवाह',
      steps: [
        {
          title: 'डेटा संकलन',
          subtitle: 'डेटा संकलन',
          description: 'क्षेत्र अधिकारी किंवा सार्वजनिक वापरकर्ते वैयक्तिक तपशील, पत्ता, शिक्षण, दिव्यांग तपशील आणि समर्थन दस्तऐवज यासह व्यापक दिव्यांग-संबंधित माहिती गोळा करतात. डेटा मोबाइल ऍप किंवा वेब पोर्टलद्वारे गोळा केला जाऊ शकतो.',
        },
        {
          title: 'प्रारंभिक सबमिशन',
          subtitle: 'प्रारंभिक सबमिशन',
          description: 'गोळा केलेला सर्वेक्षण डेटा "pending" स्थितीसह सिस्टममध्ये सबमिट केला जातो. सिस्टम OCR तंत्रज्ञान वापरून अपलोड केलेल्या दस्तऐवजांची स्वयंचलित प्रक्रिया करते जेणेकरून संबंधित माहिती काढली जाऊ शकते आणि फॉर्म फील्ड पूर्व-भरली जाऊ शकतात.',
        },
        {
          title: 'प्रशासकीय पुनरावलोकन',
          subtitle: 'प्रशासकीय पुनरावलोकन',
          description: 'प्रशासक सबमिट केलेल्या सर्वेक्षणांचे पुनरावलोकन करतात, डेटा गुणवत्ता तपासतात आणि आवश्यक असल्यास सुधारणा सूचना जोडतात. सर्वेक्षणे तपशीलवार पुनरावलोकनासाठी पडताळणी अधिकाऱ्यांना नियुक्त केली जाऊ शकतात. स्थिती "under_review" मध्ये बदलते.',
        },
        {
          title: 'पडताळणी',
          subtitle: 'पडताळणी',
          description: 'पडताळणी अधिकारी नियुक्त केलेल्या सर्वेक्षणांचे पुनरावलोकन करतात, डेटा अचूकता सत्यापित करतात, प्रशासकीय सूचनांवर आधारित आवश्यक सुधारणा करतात आणि सखोल पुनरावलोकन आणि सत्यापनानंतर सर्वेक्षणे "verified" म्हणून चिन्हांकित करतात.',
        },
        {
          title: 'अंतिम मंजुरी',
          subtitle: 'अंतिम मंजुरी',
          description: 'प्रशासक सत्यापित सर्वेक्षणांचे पुनरावलोकन करतात आणि अंतिम मंजुरी देतात. एकदा मंजूर झाल्यानंतर, सर्वेक्षणे "approved" म्हणून चिन्हांकित केली जातात आणि अधिकृत डेटाबेसमध्ये भाग बनतात. मंजूर सर्वेक्षणे प्रमाणपत्रे तयार करण्यासाठी आणि सरकारी योजनांमध्ये प्रवेश करण्यासाठी वापरली जाऊ शकतात.',
        },
      ],
    },
    security: {
      title: 'डेटा सुरक्षा आणि एन्क्रिप्शन',
      intro: 'तुमची संवेदनशील माहिती ही आमची प्राथमिकता आहे. आम्ही समजतो की दिव्यांग-संबंधित डेटामध्ये अत्यंत संवेदनशील वैयक्तिक माहिती असते आणि आम्ही तुमच्या डेटाचे संरक्षण करण्यासाठी अनेक स्तरांची सुरक्षा लागू केली आहे.',
      features: {
        encryption: {
          title: 'एंड-टू-एंड एन्क्रिप्शन',
          description: 'तुमच्या डिव्हाइस आणि आमच्या सर्व्हरमधील सर्व डेटा उद्योग-मानक TLS/SSL प्रोटोकॉल वापरून एन्क्रिप्ट केला जातो. हे सुनिश्चित करते की प्रसारणादरम्यान तुमची माहिती अडवली किंवा वाचली जाऊ शकत नाही.',
        },
        database: {
          title: 'डेटाबेस एन्क्रिप्शन',
          description: 'आमच्या डेटाबेसमध्ये संग्रहित संवेदनशील डेटा AES-256 एन्क्रिप्शन वापरून विश्रांतीवर एन्क्रिप्ट केला जातो, बँका आणि सरकारी एजन्सीद्वारे वापरले जाणारे समान मानक. याचा अर्थ असा की सर्व्हरमध्ये भौतिक प्रवेश मिळाला तरीही तुमचा डेटा संरक्षित आहे.',
        },
        access: {
          title: 'भूमिका-आधारित प्रवेश नियंत्रण',
          description: 'संवेदनशील डेटामध्ये प्रवेश भूमिका-आधारित परवानग्यांद्वारे काटेकोरपणे नियंत्रित केला जातो. फक्त विशिष्ट भूमिका असलेले अधिकृत कर्मचारी त्यांच्या जबाबदाऱ्यांशी संबंधित डेटामध्ये प्रवेश, पाहू किंवा सुधारू शकतात.',
        },
        storage: {
          title: 'सुरक्षित फाइल स्टोरेज',
          description: 'आधार कार्ड आणि प्रमाणपत्रांसारख्या अपलोड केलेल्या दस्तऐवजांना प्रतिबंधित प्रवेशासह एन्क्रिप्टेड स्टोरेजमध्ये संग्रहित केले जाते. पडताळणी प्रक्रियेदरम्यान फक्त अधिकृत कर्मचाऱ्यांना फाइल्समध्ये प्रवेश मिळू शकतो.',
        },
        audit: {
          title: 'ऑडिट लॉगिंग',
          description: 'सर्व डेटा प्रवेश आणि सुधारणा वेळस्टॅम्प आणि वापरकर्ता माहितीसह लॉग केल्या जातात. हे अनुपालन आणि सुरक्षा निरीक्षण हेतूंसाठी एक संपूर्ण ऑडिट ट्रेल तयार करते.',
        },
        updates: {
          title: 'नियमित सुरक्षा अद्यतने',
          description: 'उदयोन्मुख धोक्यांपासून संरक्षण करण्यासाठी आमच्या सुरक्षा पायाभूत सुविधांची नियमित अद्यतने केली जातात. आम्ही उद्योग सर्वोत्तम पद्धतींचे अनुसरण करतो आणि सरकारी डेटा संरक्षण मार्गदर्शक तत्त्वांचे अनुपालन करतो.',
        },
      },
      privacy: 'गोपनीयता वचन: तुमची वैयक्तिक माहिती केवळ दिव्यांग पुनर्वसन सेवा प्रदान करण्याच्या उद्देशाने वापरली जाते. डेटा तृतीय-पक्ष व्यावसायिक संस्थांसोबत कधीही सामायिक केला जात नाही किंवा विपणन हेतूंसाठी वापरला जात नाही. सर्व डेटा हाताळणी सरकारी नियम आणि गोपनीयता कायद्यांचे अनुपालन करते.',
    },
    cta: {
      title: 'सुरू करण्यासाठी तयार आहात?',
      text: 'दिव्यांग असलेल्या व्यक्तींना सक्षम करण्याच्या आमच्या मिशनमध्ये सामील व्हा. आमच्या सेवांमध्ये प्रवेश करा किंवा आमच्या व्यापक सर्वेक्षण कार्यक्रमात सहभागी व्हा.',
      startSurvey: 'सार्वजनिक सर्वेक्षण सुरू करा',
    },
    footer: {
      title: 'DDRC अहिल्यानगर',
      description: 'जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर\nसामाजिक न्याय आणि सक्षमीकरण मंत्रालय, भारत सरकार',
      quickLinks: 'द्रुत दुवे',
      contact: 'संपर्क',
      address: 'जिल्हा दिव्यांग पुनर्वसन केंद्र\nअहिल्यानगर, महाराष्ट्र, भारत',
      poweredBy: 'द्वारा संचालित',
      copyright: 'DDRC अहिल्यानगर. सर्व हक्क राखीव.',
    },
  },
};

// Carousel slides data
const carouselSlides = [
  {
    id: 1,
    bgImage: '/app_back.jpg',
  },
  {
    id: 2,
    bgImage: '/app_back.jpg',
  },
  {
    id: 3,
    bgImage: '/app_back.jpg',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const downloadSectionRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  // Language state - load from localStorage or default to 'mr' (Marathi)
  const [language, setLanguage] = useState<'en' | 'mr'>(() => {
    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('app_language');
      return (storedLang === 'en' || storedLang === 'mr') ? storedLang : 'mr';
    }
    return 'mr';
  });

  // Check if user is coming from login page and needs to scroll
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userType = urlParams.get('userType');
    const scrollToDownload = urlParams.get('scrollToDownload');
    
    if (scrollToDownload === 'true' && downloadSectionRef.current) {
      setTimeout(() => {
        downloadSectionRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }, 500);
    }
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, carouselSlides.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const scrollToDownload = () => {
    if (downloadSectionRef.current) {
      downloadSectionRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // Toggle language and save to localStorage
  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'mr' : 'en';
    setLanguage(newLanguage);
    localStorage.setItem('app_language', newLanguage);
    // Optionally reload the page to apply language changes
    // window.location.reload();
  };

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-navbar">
        <div className="container">
          <div className="navbar-content">
            <div className="navbar-brand">
              <img src={LOGO_URL} alt="DDRC Logo" className="navbar-logo" />
              <div className="navbar-brand-text">
                <span className="brand-title">DDRC</span>
                <span className="brand-subtitle">Ahilyanagar</span>
              </div>
            </div>
            <div className="navbar-center">
              {/* Language Switch Button - Centered */}
              <button
                className="btn btn-link text-primary"
                onClick={toggleLanguage}
                title={language === 'en' ? 'Switch to Marathi' : 'Switch to English'}
                style={{ textDecoration: 'none', padding: '0.5rem' }}
              >
                <i className="bi bi-translate" style={{ fontSize: '1.125rem' }}></i>
                <span className="ms-1" style={{ fontSize: '0.875rem' }}>
                  {language === 'en' ? 'MR' : 'EN'}
                </span>
              </button>
            </div>
            <div className="navbar-actions">
              <Link href="/public" className="btn btn-outline-primary btn-sm me-2">
                {translations[language].nav.publicSurvey}
              </Link>
              <Link href="/login" className="btn btn-primary btn-sm">
                {translations[language].nav.login}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Full-Screen Carousel */}
      <section className="hero-carousel">
        {carouselSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`carousel-slide ${index === currentSlide ? 'active' : ''}`}
            style={{
              backgroundImage: `url(${getAbsoluteImageUrl(slide.bgImage)})`,
            }}
          >
            <div className="carousel-overlay"></div>
            <div className="carousel-content">
              <div className="container">
                <div className="carousel-text">
                  <h1 className="carousel-title animate__animated animate__fadeInDown">
                    {translations[language].carousel[index].title}
                  </h1>
                  <p className="carousel-description animate__animated animate__fadeInUp">
                    {translations[language].carousel[index].description}
                  </p>
                  <div className="carousel-actions animate__animated animate__fadeInUp">
                    <Link href="/public" className="btn btn-primary btn-lg me-3">
                      {translations[language].carouselActions.startSurvey}
                    </Link>
                    <Link href="/login" className="btn btn-outline-light btn-lg">
                      {translations[language].nav.login}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Controls */}
        <button className="carousel-control prev" onClick={prevSlide} aria-label="Previous slide">
          <i className="bi bi-chevron-left"></i>
        </button>
        <button className="carousel-control next" onClick={nextSlide} aria-label="Next slide">
          <i className="bi bi-chevron-right"></i>
        </button>

        {/* Carousel Indicators */}
        <div className="carousel-indicators">
          {carouselSlides.map((_, index) => (
            <button
              key={index}
              className={`indicator ${index === currentSlide ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Download Mobile App Section */}
      <section ref={downloadSectionRef} className="landing-section download-section">
        <div className="container">
          <div className="download-card">
            <div className="download-header">
              <div className="download-icon">
                <i className="bi bi-phone"></i>
              </div>
              <h2 className="download-title">
                {translations[language].download.title}
              </h2>
              <p className="download-subtitle">
                {translations[language].download.subtitle}
              </p>
            </div>
            <div className="download-content">
              <div className="row align-items-center">
                <div className="col-lg-6">
                  <div className="download-info">
                    <h3>{translations[language].download.forFieldOfficers}</h3>
                    <p className="download-text">
                      {translations[language].download.description}
                    </p>
                    <div className="download-features">
                      <div className="download-feature-item">
                        <i className="bi bi-check-circle-fill"></i>
                        <span>{translations[language].download.features.offline}</span>
                      </div>
                      <div className="download-feature-item">
                        <i className="bi bi-check-circle-fill"></i>
                        <span>{translations[language].download.features.ocr}</span>
                      </div>
                      <div className="download-feature-item">
                        <i className="bi bi-check-circle-fill"></i>
                        <span>{translations[language].download.features.sync}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6 text-center">
                  <div className="play-store-badge">
                    <a 
                      href="javascript:void(0)" 
                      className="play-store-link"
                      onClick={(e) => e.preventDefault()}
                    >
                      <img 
                        src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
                        alt="Get it on Google Play" 
                        className="play-store-image"
                      />
                    </a>
                    <p className="play-store-note">
                      {translations[language].download.comingSoon}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Surveys Section */}
      <section className="landing-section about-surveys-section">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="section-title">
              {translations[language].about.title}
            </h2>
          </div>
          <div className="row">
            <div className="col-lg-8 mx-auto">
              <div className="content-card">
                <p className="section-text">
                  {translations[language].about.text1}
                </p>
                <p className="section-text">
                  {translations[language].about.text2}
                </p>
                <div className="survey-features">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="feature-box">
                        <i className="bi bi-check-circle-fill text-primary"></i>
                        <span>{translations[language].about.features.multiSection}</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="feature-box">
                        <i className="bi bi-check-circle-fill text-primary"></i>
                        <span>{translations[language].about.features.ocr}</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="feature-box">
                        <i className="bi bi-check-circle-fill text-primary"></i>
                        <span>{translations[language].about.features.offline}</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="feature-box">
                        <i className="bi bi-check-circle-fill text-primary"></i>
                        <span>{translations[language].about.features.sync}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* User Roles Section */}
      <section className="landing-section roles-section">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="section-title">
              {translations[language].roles.title}
            </h2>
            <p className="section-subtitle">
              {translations[language].roles.subtitle}
            </p>
          </div>
          <div className="row g-4">
            <div className="col-lg-6">
              <div className="role-card">
                <div className="role-icon">
                  <i className="bi bi-phone"></i>
                </div>
                <h3 className="role-title">{translations[language].roles.fieldOfficer.title}</h3>
                <ul className="role-responsibilities">
                  {translations[language].roles.fieldOfficer.responsibilities.map((resp, idx) => (
                    <li key={idx}>{resp}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="role-card">
                <div className="role-icon">
                  <i className="bi bi-shield-check"></i>
                </div>
                <h3 className="role-title">{translations[language].roles.verificationOfficer.title}</h3>
                <ul className="role-responsibilities">
                  {translations[language].roles.verificationOfficer.responsibilities.map((resp, idx) => (
                    <li key={idx}>{resp}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="role-card">
                <div className="role-icon">
                  <i className="bi bi-person-badge"></i>
                </div>
                <h3 className="role-title">{translations[language].roles.administrator.title}</h3>
                <ul className="role-responsibilities">
                  {translations[language].roles.administrator.responsibilities.map((resp, idx) => (
                    <li key={idx}>{resp}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="role-card">
                <div className="role-icon">
                  <i className="bi bi-person"></i>
                </div>
                <h3 className="role-title">{translations[language].roles.beneficiary.title}</h3>
                <ul className="role-responsibilities">
                  {translations[language].roles.beneficiary.responsibilities.map((resp, idx) => (
                    <li key={idx}>{resp}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Survey Process Phases Section */}
      <section className="landing-section process-section">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="section-title">
              {translations[language].process.title}
            </h2>
            <p className="section-subtitle">
              {translations[language].process.subtitle}
            </p>
          </div>
          <div className="process-timeline">
            {translations[language].process.steps.map((step, index) => (
              <div key={index} className="process-step">
                <div className="step-number">{index + 1}</div>
                <div className="step-content">
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-description">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Security Section - Highlighted */}
      <section className="landing-section security-section">
        <div className="container">
          <div className="security-card">
            <div className="security-header">
              <div className="security-icon">
                <i className="bi bi-shield-lock-fill"></i>
              </div>
              <h2 className="security-title">
                {translations[language].security.title}
              </h2>
            </div>
            <div className="security-content">
              <p className="security-intro">
                <strong>{translations[language].security.intro.split('.')[0]}.</strong> {translations[language].security.intro.split('.').slice(1).join('.').trim()}
              </p>
              
              <div className="security-features">
                <div className="row g-4">
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-key-fill"></i>
                      <div>
                        <h4>{translations[language].security.features.encryption.title}</h4>
                        <p>{translations[language].security.features.encryption.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-database-lock"></i>
                      <div>
                        <h4>{translations[language].security.features.database.title}</h4>
                        <p>{translations[language].security.features.database.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-person-check-fill"></i>
                      <div>
                        <h4>{translations[language].security.features.access.title}</h4>
                        <p>{translations[language].security.features.access.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-file-earmark-lock"></i>
                      <div>
                        <h4>{translations[language].security.features.storage.title}</h4>
                        <p>{translations[language].security.features.storage.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-clock-history"></i>
                      <div>
                        <h4>{translations[language].security.features.audit.title}</h4>
                        <p>{translations[language].security.features.audit.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-shield-check"></i>
                      <div>
                        <h4>{translations[language].security.features.updates.title}</h4>
                        <p>{translations[language].security.features.updates.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="security-note">
                <i className="bi bi-info-circle-fill"></i>
                <p>
                  <strong>{translations[language].security.privacy.split(':')[0]}:</strong> {translations[language].security.privacy.split(':').slice(1).join(':').trim()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-section cta-section">
        <div className="container">
          <div className="cta-content text-center">
            <h2 className="cta-title">
              {translations[language].cta.title}
            </h2>
            <p className="cta-text">
              {translations[language].cta.text}
            </p>
            <div className="cta-actions">
              <Link href="/public" className="btn btn-primary btn-lg me-3">
                <i className="bi bi-clipboard-check me-2"></i>
                {translations[language].cta.startSurvey}
              </Link>
              <Link href="/login" className="btn btn-outline-primary btn-lg">
                <i className="bi bi-box-arrow-in-right me-2"></i>
                {translations[language].nav.login}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="row">
            <div className="col-md-4">
              <div className="footer-brand">
                <img src={LOGO_URL} alt="DDRC Logo" className="footer-logo" />
                <h3>{translations[language].footer.title}</h3>
                <p>
                  {translations[language].footer.description.split('\n').map((line, idx) => (
                    <span key={idx}>{line}{idx === 0 && <br />}</span>
                  ))}
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <h4>{translations[language].footer.quickLinks}</h4>
              <ul className="footer-links">
                <li><Link href="/public">{translations[language].nav.publicSurvey}</Link></li>
                <li><Link href="/login">{translations[language].nav.login}</Link></li>
                <li><Link href="/dashboard">Dashboard</Link></li>
              </ul>
            </div>
            <div className="col-md-4">
              <h4>{translations[language].footer.contact}</h4>
              <p>
                {translations[language].footer.address.split('\n').map((line, idx) => (
                  <span key={idx}>{line}{idx === 0 && <br />}</span>
                ))}
              </p>
              <p className="footer-powered">
                {translations[language].footer.poweredBy} <a href="https://ddrcnagar.in" target="_blank" rel="noopener noreferrer" className="footer-utkrranti">UTKRRANTI</a>
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} {translations[language].footer.copyright}</p>
        </div>
        </div>
      </footer>
    </div>
  );
}
