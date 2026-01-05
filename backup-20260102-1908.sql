PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    
    -- Personal information
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date TEXT NOT NULL, -- ISO format: YYYY-MM-DD
    
    -- Address
    address_street TEXT NOT NULL,
    address_number TEXT NOT NULL,
    address_zip TEXT NOT NULL,
    address_city TEXT NOT NULL,
    
    -- Contact information
    phone TEXT NOT NULL,
    whatsapp TEXT, -- Optional WhatsApp number
    telegram TEXT, -- Optional Telegram username/ID
    
    -- Consent and permissions (0 = no, 1 = yes)
    photo_video_consent INTEGER NOT NULL DEFAULT 0, -- Consent for photo/video at events
    parental_consent INTEGER NOT NULL DEFAULT 0, -- Required if age < 18
    
    -- Preferences and status
    preferred_language TEXT NOT NULL DEFAULT 'de', -- de/en/ru/uk
    is_blocked INTEGER NOT NULL DEFAULT 0, -- Block access if deletion pending
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
, guardian_first_name TEXT, guardian_last_name TEXT, guardian_phone TEXT, guardian_consent INTEGER DEFAULT 0, password_reset_token_hash TEXT, password_reset_expires_at TEXT);
INSERT INTO "users" VALUES(3,'berufsorientierung@kolibri-dresden.de','$2b$10$cxoNTDar2.pt1cGp1yoZP.y3wwOvtBC.wY1cK7S.yuXywzYrxGLju','Julia','Koltygina','1988-03-22','Behrischstraße','20','01277','Dresden','+4915154358877',NULL,NULL,0,0,'de',0,'2025-11-13T17:10:01','2025-11-16T19:12:11',NULL,NULL,NULL,0,NULL,NULL);
INSERT INTO "users" VALUES(9,'shks.solomon@gmail.com','$2b$10$8ou.yImU7Hq7pJSBYTY8hOuNa2UhXvPEFJYYosJMFHopqex.JIqPu','Konstantin','Shakun','1977-09-11','Behrischstraße','9','01277','Dresden','+4915154358098',NULL,NULL,0,0,'ru',0,'2025-11-16T18:30:12','2025-11-19T10:13:36',NULL,NULL,NULL,0,'d41098aaa008b034a4dbf292ea1277c4a5c346cb26bf8f86db27bdc83c1193ac','2025-11-19T02:23:45');
INSERT INTO "users" VALUES(12,'gluon2008@gmail.com','$2b$10$lnoAHEXTwLPZS.ZLzuixNe3NLmgpdIg4SrSM7jZ5VZMclt2ZdeXH2','Iwan','Melnikoff','2000-01-20','Monkstr.','5','01752','Dresden','+4915154365870','+4915154358098','@solomonw11',1,0,'de',0,'2025-11-18T16:27:54','2025-11-18T18:41:38',NULL,NULL,NULL,0,NULL,NULL);
INSERT INTO "users" VALUES(16,'gluontevery@gmail.com','$2b$10$wetviVELn5ZW7T0tQ7tMn.YKS.SrFYcQRehqnBUGb/6JiWvTjjD9S','Tanusha','Lapochka','1970-02-05','Bubustr','4','01122','Dresden','+380675594451',NULL,NULL,1,0,'ru',0,'2025-11-19T02:20:31','2025-11-19T02:20:49',NULL,NULL,NULL,0,NULL,NULL);
INSERT INTO "users" VALUES(17,'titoki2526@gmail.com','$2b$10$EjtKA8zgiMc5b1dWxbd41.sjQONL.T0LpksU7i676b33iEvwBu2DK','Iryna','Titok','1999-09-26','Fritz-Buschstr.','3','01219','Dresden','+4915146287425','+4915146287425','@titokiii',0,0,'ru',0,'2025-11-24T13:13:00','2025-11-24T13:21:07',NULL,NULL,NULL,0,NULL,NULL);
INSERT INTO "users" VALUES(18,'ekaterina.olekh@kolibri-dresden.de','$2b$10$3rNqYp0x5zZtIUt/36C4ru1Y0dlYsvkMl2elwV37b/60FvZ.piSMm','Ekaterina','Olekh','1978-09-12','Freiberger Str.','2','01067','Dresden','+491733544662','+491733544662','@EkaterinaOlekh',1,0,'de',0,'2025-11-24T13:19:16','2025-11-24T13:19:16',NULL,NULL,NULL,0,NULL,NULL);
CREATE TABLE event_additional_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    -- Field configuration
    field_key TEXT NOT NULL, -- Unique identifier for the field (e.g., 'dietary_preferences')
    field_type TEXT NOT NULL, -- text/select/checkbox/date/number
    field_options TEXT, -- JSON array of options for select type: ["Option 1", "Option 2"]
    required INTEGER DEFAULT 0, -- 0 = optional, 1 = required
    
    -- Multilingual labels
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_ru TEXT,
    label_uk TEXT,
    
    -- Multilingual placeholders
    placeholder_de TEXT,
    placeholder_en TEXT,
    placeholder_ru TEXT,
    placeholder_uk TEXT,
    
    -- Ensure unique field keys per event
    UNIQUE(event_id, field_key)
);
CREATE TABLE registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    event_id INTEGER NOT NULL REFERENCES events(id),
    
    -- Additional data from event_additional_fields
    -- JSON format: {"field_key": "value", ...}
    additional_data TEXT,
    
    -- Registration tracking
    registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TEXT, -- NULL if active, timestamp if cancelled
    cancellation_reason TEXT,
    
    -- Prevent duplicate registrations
    UNIQUE(user_id, event_id)
);
INSERT INTO "registrations" VALUES(3,12,5,NULL,'2025-11-18T18:42:12','2025-11-22T14:31:27','User cancelled via profile');
INSERT INTO "registrations" VALUES(4,9,5,NULL,'2025-11-18T18:44:27',NULL,NULL);
INSERT INTO "registrations" VALUES(5,3,5,NULL,'2025-11-24T13:27:50',NULL,NULL);
INSERT INTO "registrations" VALUES(6,17,5,NULL,'2025-11-24T13:37:45',NULL,NULL);
INSERT INTO "registrations" VALUES(7,18,5,NULL,'2025-11-24T13:38:15',NULL,NULL);
CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Admin who granted these rights
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "admins" VALUES(1,3,NULL,'2025-11-13 17:13:28');
INSERT INTO "admins" VALUES(3,17,3,'2025-11-24 13:14:08');
INSERT INTO "admins" VALUES(4,18,17,'2025-11-24 13:24:22');
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL for anonymous/system actions
    action_type TEXT NOT NULL, -- e.g., 'user_register', 'event_create', 'registration_create'
    details TEXT, -- JSON with additional context
    ip_address TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "activity_log" VALUES(1,NULL,'user_register','{"email":"shks.solomon@gmail.com","language":"ru","age":48,"parental_consent_required":false}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 16:23:06');
INSERT INTO "activity_log" VALUES(2,NULL,'user_register','{"email":"gluon2008@gmail.com","language":"ru","age":48,"parental_consent_required":false}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 16:44:26');
INSERT INTO "activity_log" VALUES(3,NULL,'user_login','{"email":"gluon2008@gmail.com"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 16:47:00');
INSERT INTO "activity_log" VALUES(4,NULL,'user_logout','{"email":"gluon2008@gmail.com"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 16:47:21');
INSERT INTO "activity_log" VALUES(5,NULL,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 16:48:04');
INSERT INTO "activity_log" VALUES(6,NULL,'user_login_failed','{"reason":"invalid_password"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 16:48:37');
INSERT INTO "activity_log" VALUES(7,NULL,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 16:49:02');
INSERT INTO "activity_log" VALUES(8,NULL,'user_logout','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 16:49:13');
INSERT INTO "activity_log" VALUES(9,3,'user_register','{"email":"berufsorientierung@kolibri-dresden.de","language":"ru","age":37,"parental_consent_required":false}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:10:01');
INSERT INTO "activity_log" VALUES(10,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:10:31');
INSERT INTO "activity_log" VALUES(11,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:11:34');
INSERT INTO "activity_log" VALUES(12,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:14:24');
INSERT INTO "activity_log" VALUES(13,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:24:11');
INSERT INTO "activity_log" VALUES(14,NULL,'user_register','{"email":"shks.solomon@gmail.com","language":"ru","age":48,"parental_consent_required":false}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:30:01');
INSERT INTO "activity_log" VALUES(15,NULL,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:32:36');
INSERT INTO "activity_log" VALUES(16,NULL,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:32:46');
INSERT INTO "activity_log" VALUES(17,NULL,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:33:04');
INSERT INTO "activity_log" VALUES(18,NULL,'user_logout','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:33:11');
INSERT INTO "activity_log" VALUES(19,NULL,'user_register','{"email":"gluon2008@gmail.com","language":"ru","age":48,"parental_consent_required":false}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:34:14');
INSERT INTO "activity_log" VALUES(20,NULL,'user_logout','{"email":"gluon2008@gmail.com"}','2a02:810a:8c89:4700:4190:1d7b:9e94:b315','2025-11-13 17:37:38');
INSERT INTO "activity_log" VALUES(21,NULL,'user_register','{"email":"shks.solomon@gmail.com","language":"ru","age":48,"parental_consent_required":false}','81.201.155.73','2025-11-14 18:02:59');
INSERT INTO "activity_log" VALUES(22,NULL,'user_logout','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-14 18:03:43');
INSERT INTO "activity_log" VALUES(23,NULL,'user_register','{"email":"shks.solomon@gmail.com","language":"ru","age":48,"parental_consent_required":false}','81.201.155.73','2025-11-14 18:05:05');
INSERT INTO "activity_log" VALUES(24,NULL,'user_logout','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-14 18:06:00');
INSERT INTO "activity_log" VALUES(25,NULL,'user_register','{"email":"shks.solomon@gmail.com","language":"ru","age":48,"parental_consent_required":false}','2a02:810a:8c89:4700:65ad:26d9:1aa6:5637','2025-11-16 18:09:02');
INSERT INTO "activity_log" VALUES(26,9,'user_register','{"email":"shks.solomon@gmail.com","language":"ru","age":48,"parental_consent_required":false}','2a02:810a:8c89:4700:65ad:26d9:1aa6:5637','2025-11-16 18:30:12');
INSERT INTO "activity_log" VALUES(27,9,'user_logout','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:65ad:26d9:1aa6:5637','2025-11-16 19:05:20');
INSERT INTO "activity_log" VALUES(28,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:65ad:26d9:1aa6:5637','2025-11-16 19:11:36');
INSERT INTO "activity_log" VALUES(29,3,'user_update_profile','Updated fields: first_name, last_name, birth_date, address_street, address_number, address_zip, address_city, phone, whatsapp, telegram, photo_video_consent, parental_consent, preferred_language, email',NULL,'2025-11-16 19:12:11');
INSERT INTO "activity_log" VALUES(30,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','77.23.253.10','2025-11-16 19:23:25');
INSERT INTO "activity_log" VALUES(31,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 12:45:24');
INSERT INTO "activity_log" VALUES(32,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 12:45:37');
INSERT INTO "activity_log" VALUES(33,9,'user_login','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-17 12:45:45');
INSERT INTO "activity_log" VALUES(34,9,'user_update_profile','Updated fields: first_name, last_name, birth_date, address_street, address_number, address_zip, address_city, phone, whatsapp, telegram, photo_video_consent, parental_consent, preferred_language, email',NULL,'2025-11-17 12:46:05');
INSERT INTO "activity_log" VALUES(35,9,'user_logout','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-17 12:46:21');
INSERT INTO "activity_log" VALUES(36,NULL,'user_register','{"email":"gluon2008@gmail.com","language":"de","age":48,"parental_consent_required":false}','81.201.155.73','2025-11-17 12:47:37');
INSERT INTO "activity_log" VALUES(37,NULL,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-17 12:48:32');
INSERT INTO "activity_log" VALUES(38,9,'user_login','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-17 12:48:41');
INSERT INTO "activity_log" VALUES(39,9,'user_logout','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-17 12:49:02');
INSERT INTO "activity_log" VALUES(40,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 13:31:00');
INSERT INTO "activity_log" VALUES(41,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 14:06:12');
INSERT INTO "activity_log" VALUES(42,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 14:08:16');
INSERT INTO "activity_log" VALUES(43,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 14:09:27');
INSERT INTO "activity_log" VALUES(44,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 14:10:07');
INSERT INTO "activity_log" VALUES(45,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 14:22:09');
INSERT INTO "activity_log" VALUES(46,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 14:22:15');
INSERT INTO "activity_log" VALUES(47,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 14:23:15');
INSERT INTO "activity_log" VALUES(48,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 14:23:39');
INSERT INTO "activity_log" VALUES(49,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 14:44:52');
INSERT INTO "activity_log" VALUES(50,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 15:28:16');
INSERT INTO "activity_log" VALUES(51,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 15:31:15');
INSERT INTO "activity_log" VALUES(52,3,'event_create','{"event_id":1,"event_title":"Exkursion zur Gläsernen Manufaktur","status":"draft","ip":"81.201.155.73"}','81.201.155.73','2025-11-17 15:35:08');
INSERT INTO "activity_log" VALUES(53,3,'event_publish','{"event_id":1,"event_title":"Exkursion zur Gläsernen Manufaktur","ip":"81.201.155.73"}','81.201.155.73','2025-11-17 15:36:49');
INSERT INTO "activity_log" VALUES(54,3,'bulk_email_sent','{"recipientType":"custom","eventId":null,"language":"de","subject":"Bevorstehende Veranstaltung","totalRecipients":2,"sent":2,"failed":0}',NULL,'2025-11-17 15:43:58');
INSERT INTO "activity_log" VALUES(55,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 15:44:52');
INSERT INTO "activity_log" VALUES(56,9,'user_login','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-17 15:45:46');
INSERT INTO "activity_log" VALUES(57,9,'registration_create','{"event_id":1,"registration_id":1,"event_title":"Exkursion zur Gläsernen Manufaktur"}','81.201.155.73','2025-11-17 15:48:17');
INSERT INTO "activity_log" VALUES(58,9,'user_logout','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-17 15:50:33');
INSERT INTO "activity_log" VALUES(59,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 15:54:49');
INSERT INTO "activity_log" VALUES(60,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 16:58:30');
INSERT INTO "activity_log" VALUES(61,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 17:02:29');
INSERT INTO "activity_log" VALUES(62,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 17:45:31');
INSERT INTO "activity_log" VALUES(63,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 17:48:23');
INSERT INTO "activity_log" VALUES(64,3,'event_update','{"event_id":1,"event_title":"Exkursion zur Gläsernen Manufaktur","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-17 17:50:45');
INSERT INTO "activity_log" VALUES(65,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 17:51:18');
INSERT INTO "activity_log" VALUES(66,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-17 17:51:18');
INSERT INTO "activity_log" VALUES(67,NULL,'user_login','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-17 17:51:52');
INSERT INTO "activity_log" VALUES(68,NULL,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-17 18:02:11');
INSERT INTO "activity_log" VALUES(69,NULL,'user_login','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-17 18:06:43');
INSERT INTO "activity_log" VALUES(70,NULL,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-17 18:07:18');
INSERT INTO "activity_log" VALUES(71,NULL,'user_login','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 11:13:44');
INSERT INTO "activity_log" VALUES(72,NULL,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 12:17:22');
INSERT INTO "activity_log" VALUES(73,NULL,'user_login','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 14:37:09');
INSERT INTO "activity_log" VALUES(74,NULL,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 15:17:54');
INSERT INTO "activity_log" VALUES(75,NULL,'user_register','{"email":"konstantin.shakun@kolibri-dresden.de","language":"de","age":15,"parental_consent_required":true}','81.201.155.73','2025-11-18 15:22:59');
INSERT INTO "activity_log" VALUES(76,NULL,'user_logout','{"email":"konstantin.shakun@kolibri-dresden.de"}','81.201.155.73','2025-11-18 15:24:44');
INSERT INTO "activity_log" VALUES(77,NULL,'user_login','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 15:24:58');
INSERT INTO "activity_log" VALUES(78,NULL,'profile_deleted_immediate','{"deleted_user_id":10,"email":"gluon2008@gmail.com","reason":"immediate_deletion"}',NULL,'2025-11-18 15:26:02');
INSERT INTO "activity_log" VALUES(79,NULL,'user_login_failed','{"reason":"invalid_email","email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 15:34:47');
INSERT INTO "activity_log" VALUES(80,NULL,'user_login','{"email":"konstantin.shakun@kolibri-dresden.de"}','81.201.155.73','2025-11-18 16:11:58');
INSERT INTO "activity_log" VALUES(81,NULL,'profile_deleted_immediate','{"deleted_user_id":11,"email":"konstantin.shakun@kolibri-dresden.de","reason":"immediate_deletion"}',NULL,'2025-11-18 16:12:10');
INSERT INTO "activity_log" VALUES(82,12,'user_register','{"email":"gluon2008@gmail.com","language":"de","age":25,"parental_consent_required":false}','81.201.155.73','2025-11-18 16:27:55');
INSERT INTO "activity_log" VALUES(83,12,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 16:28:05');
INSERT INTO "activity_log" VALUES(84,NULL,'user_register','{"email":"konstantin.shakun@kolibri-dresden.de","language":"de","age":13,"parental_consent_required":true}','81.201.155.73','2025-11-18 16:30:16');
INSERT INTO "activity_log" VALUES(85,NULL,'user_update_profile','Updated fields: first_name, last_name, birth_date, address_street, address_number, address_zip, address_city, phone, whatsapp, telegram, photo_video_consent, parental_consent, preferred_language, email',NULL,'2025-11-18 16:30:33');
INSERT INTO "activity_log" VALUES(86,NULL,'user_logout','{"email":"konstantin.shakun@kolibri-dresden.de"}','81.201.155.73','2025-11-18 16:30:43');
INSERT INTO "activity_log" VALUES(87,NULL,'user_login','{"email":"konstantin.shakun@kolibri-dresden.de"}','81.201.155.73','2025-11-18 16:40:11');
INSERT INTO "activity_log" VALUES(88,NULL,'profile_deleted_immediate','{"deleted_user_id":13,"email":"konstantin.shakun@kolibri-dresden.de","reason":"immediate_deletion"}',NULL,'2025-11-18 16:40:53');
INSERT INTO "activity_log" VALUES(89,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 16:41:21');
INSERT INTO "activity_log" VALUES(90,3,'event_cancelled','{"event_id":1,"event_title":"Exkursion zur Gläsernen Manufaktur","reason":"Leider unsere Exkursion findet nicth statt, da weniger Zahl von Teilnehmer"}',NULL,'2025-11-18T16:43:19.998Z');
INSERT INTO "activity_log" VALUES(91,3,'event_cancel','{"event_id":1,"event_title":"Exkursion zur Gläsernen Manufaktur","cancellation_reason":"Leider unsere Exkursion findet nicth statt, da weniger Zahl von Teilnehmer","affected_users":1}','81.201.155.73','2025-11-18 16:43:20');
INSERT INTO "activity_log" VALUES(92,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 17:11:25');
INSERT INTO "activity_log" VALUES(93,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 17:25:27');
INSERT INTO "activity_log" VALUES(94,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 17:25:49');
INSERT INTO "activity_log" VALUES(95,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 17:29:59');
INSERT INTO "activity_log" VALUES(96,3,'event_create','{"event_id":2,"event_title":"Hopapa!","status":"draft","ip":"81.201.155.73"}','81.201.155.73','2025-11-18 17:32:22');
INSERT INTO "activity_log" VALUES(97,3,'event_delete','{"event_id":2,"event_title":"Hopapa!","ip":"81.201.155.73"}','81.201.155.73','2025-11-18 17:32:41');
INSERT INTO "activity_log" VALUES(98,3,'event_create','{"event_id":3,"event_title":"Hopapa!","status":"draft","ip":"81.201.155.73"}','81.201.155.73','2025-11-18 17:33:44');
INSERT INTO "activity_log" VALUES(99,3,'event_publish','{"event_id":3,"event_title":"Hopapa!","ip":"81.201.155.73"}','81.201.155.73','2025-11-18 17:33:51');
INSERT INTO "activity_log" VALUES(100,3,'event_cancelled','{"event_id":3,"event_title":"Hopapa!","reason":"adadadadasdas"}',NULL,'2025-11-18T17:34:28.181Z');
INSERT INTO "activity_log" VALUES(101,3,'event_cancel','{"event_id":3,"event_title":"Hopapa!","cancellation_reason":"adadadadasdas","affected_users":0}','81.201.155.73','2025-11-18 17:34:28');
INSERT INTO "activity_log" VALUES(102,3,'event_delete','{"event_id":3,"event_title":"Hopapa!","ip":"81.201.155.73"}','81.201.155.73','2025-11-18 17:34:34');
INSERT INTO "activity_log" VALUES(103,3,'admin_add','{"targetUserId":9,"targetUserEmail":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-18 17:35:28');
INSERT INTO "activity_log" VALUES(104,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 17:35:50');
INSERT INTO "activity_log" VALUES(105,NULL,'user_login_failed','{"reason":"invalid_email","email":"konstantin.shakun@kolibri-dresden.de"}','81.201.155.73','2025-11-18 17:36:16');
INSERT INTO "activity_log" VALUES(106,9,'user_login','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-18 17:36:22');
INSERT INTO "activity_log" VALUES(107,9,'user_logout','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-18 17:38:10');
INSERT INTO "activity_log" VALUES(108,9,'user_login','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-18 18:02:21');
INSERT INTO "activity_log" VALUES(109,9,'event_create','{"event_id":4,"event_title":"sdasdad","status":"draft","ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:07:27');
INSERT INTO "activity_log" VALUES(110,9,'event_publish','{"event_id":4,"event_title":"sdasdad","ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:07:42');
INSERT INTO "activity_log" VALUES(111,9,'user_logout','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-18 18:07:45');
INSERT INTO "activity_log" VALUES(112,12,'user_login','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 18:08:05');
INSERT INTO "activity_log" VALUES(113,12,'registration_create','{"event_id":4,"registration_id":2,"event_title":"sdasdad"}','81.201.155.73','2025-11-18 18:09:09');
INSERT INTO "activity_log" VALUES(114,12,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 18:09:25');
INSERT INTO "activity_log" VALUES(115,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 18:09:40');
INSERT INTO "activity_log" VALUES(116,3,'event_cancelled','{"event_id":4,"event_title":"sdasdad","reason":"erqrqwrqr fsdfdsfds eewrwrwqr ewrgtfyrty brtyryryrey"}',NULL,'2025-11-18T18:10:49.364Z');
INSERT INTO "activity_log" VALUES(117,3,'event_cancel','{"event_id":4,"event_title":"sdasdad","cancellation_reason":"erqrqwrqr fsdfdsfds eewrwrwqr ewrgtfyrty brtyryryrey","affected_users":1}','81.201.155.73','2025-11-18 18:10:49');
INSERT INTO "activity_log" VALUES(118,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 18:11:41');
INSERT INTO "activity_log" VALUES(119,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 18:15:45');
INSERT INTO "activity_log" VALUES(120,3,'event_create','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","status":"draft","ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:31:34');
INSERT INTO "activity_log" VALUES(121,3,'event_publish','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:31:47');
INSERT INTO "activity_log" VALUES(122,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 18:32:04');
INSERT INTO "activity_log" VALUES(123,12,'user_login','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 18:32:42');
INSERT INTO "activity_log" VALUES(124,12,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 18:33:42');
INSERT INTO "activity_log" VALUES(125,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 18:34:02');
INSERT INTO "activity_log" VALUES(126,3,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:34:16');
INSERT INTO "activity_log" VALUES(127,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 18:34:21');
INSERT INTO "activity_log" VALUES(128,12,'user_login','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 18:34:39');
INSERT INTO "activity_log" VALUES(129,12,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 18:35:03');
INSERT INTO "activity_log" VALUES(130,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 18:35:22');
INSERT INTO "activity_log" VALUES(131,3,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:35:46');
INSERT INTO "activity_log" VALUES(132,3,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:35:59');
INSERT INTO "activity_log" VALUES(133,3,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:36:33');
INSERT INTO "activity_log" VALUES(134,3,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:36:52');
INSERT INTO "activity_log" VALUES(135,3,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:37:12');
INSERT INTO "activity_log" VALUES(136,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 18:38:11');
INSERT INTO "activity_log" VALUES(137,12,'user_login','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 18:38:23');
INSERT INTO "activity_log" VALUES(138,12,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 18:39:36');
INSERT INTO "activity_log" VALUES(139,12,'user_login','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 18:39:59');
INSERT INTO "activity_log" VALUES(140,12,'user_update_profile','Updated fields: first_name, last_name, birth_date, address_street, address_number, address_zip, address_city, phone, whatsapp, telegram, photo_video_consent, parental_consent, preferred_language, email',NULL,'2025-11-18 18:40:20');
INSERT INTO "activity_log" VALUES(141,12,'user_update_profile','Updated fields: first_name, last_name, birth_date, address_street, address_number, address_zip, address_city, phone, whatsapp, telegram, photo_video_consent, parental_consent, preferred_language, email',NULL,'2025-11-18 18:41:38');
INSERT INTO "activity_log" VALUES(142,12,'registration_create','{"event_id":5,"registration_id":3,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)"}','81.201.155.73','2025-11-18 18:42:12');
INSERT INTO "activity_log" VALUES(143,12,'user_logout','{"email":"gluon2008@gmail.com"}','81.201.155.73','2025-11-18 18:43:42');
INSERT INTO "activity_log" VALUES(144,9,'user_login','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-18 18:44:09');
INSERT INTO "activity_log" VALUES(145,9,'registration_create','{"event_id":5,"registration_id":4,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)"}','81.201.155.73','2025-11-18 18:44:27');
INSERT INTO "activity_log" VALUES(146,9,'event_create','{"event_id":6,"event_title":"sdfasddfsawerwer","status":"draft","ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:50:22');
INSERT INTO "activity_log" VALUES(147,9,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:57:08');
INSERT INTO "activity_log" VALUES(148,9,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-18 18:58:39');
INSERT INTO "activity_log" VALUES(149,9,'user_logout','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-18 18:58:57');
INSERT INTO "activity_log" VALUES(150,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 19:00:12');
INSERT INTO "activity_log" VALUES(151,3,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-18 19:00:33');
INSERT INTO "activity_log" VALUES(152,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-18 19:00:51');
INSERT INTO "activity_log" VALUES(153,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-18 22:55:29');
INSERT INTO "activity_log" VALUES(154,3,'event_regenerate_qr','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","type":"telegram","regenerated":{"telegram":"https://pub-39e255af03de4d09a88851b299e3bf52.r2.dev/qr-codes/event-5-telegram.svg"},"ip":"2a02:810a:8c89:4700:a904:ea0a:b175:6be7"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-18 22:56:09');
INSERT INTO "activity_log" VALUES(155,3,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"2a02:810a:8c89:4700:a904:ea0a:b175:6be7"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-18 22:56:26');
INSERT INTO "activity_log" VALUES(156,3,'event_delete','{"event_id":6,"event_title":"sdfasddfsawerwer","ip":"2a02:810a:8c89:4700:a904:ea0a:b175:6be7"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-18 22:56:52');
INSERT INTO "activity_log" VALUES(157,3,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"2a02:810a:8c89:4700:a904:ea0a:b175:6be7"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-18 22:58:29');
INSERT INTO "activity_log" VALUES(158,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-18 22:58:46');
INSERT INTO "activity_log" VALUES(159,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-18 23:35:21');
INSERT INTO "activity_log" VALUES(160,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-18 23:35:32');
INSERT INTO "activity_log" VALUES(161,NULL,'user_register','{"email":"konstantin.shakun@kolibri-dresden.de","language":"de","age":22,"parental_consent_required":false}','5.248.68.60','2025-11-18 23:45:19');
INSERT INTO "activity_log" VALUES(162,NULL,'user_login_failed','{"reason":"invalid_password"}','5.248.68.60','2025-11-18 23:50:52');
INSERT INTO "activity_log" VALUES(163,NULL,'user_login_failed','{"reason":"invalid_password"}','5.248.68.60','2025-11-18 23:51:22');
INSERT INTO "activity_log" VALUES(164,NULL,'user_login','{"email":"konstantin.shakun@kolibri-dresden.de"}','5.248.68.60','2025-11-18 23:52:13');
INSERT INTO "activity_log" VALUES(165,12,'user_login','{"email":"gluon2008@gmail.com"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-18 23:59:33');
INSERT INTO "activity_log" VALUES(166,12,'user_logout','{"email":"gluon2008@gmail.com"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:04:05');
INSERT INTO "activity_log" VALUES(167,NULL,'profile_deleted_immediate','{"deleted_user_id":14,"email":"konstantin.shakun@kolibri-dresden.de","reason":"immediate_deletion"}',NULL,'2025-11-19 00:05:30');
INSERT INTO "activity_log" VALUES(168,NULL,'user_register','{"email":"konstantin.shakun@kolibri-dresden.de","language":"de","age":18,"parental_consent_required":false}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:12:28');
INSERT INTO "activity_log" VALUES(169,NULL,'user_logout','{"email":"konstantin.shakun@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:12:45');
INSERT INTO "activity_log" VALUES(170,NULL,'user_logout','{"email":"konstantin.shakun@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:12:45');
INSERT INTO "activity_log" VALUES(171,NULL,'user_login','{"email":"konstantin.shakun@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:12:54');
INSERT INTO "activity_log" VALUES(172,NULL,'user_logout','{"email":"konstantin.shakun@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:13:05');
INSERT INTO "activity_log" VALUES(173,9,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:13:15');
INSERT INTO "activity_log" VALUES(174,9,'user_logout','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:13:25');
INSERT INTO "activity_log" VALUES(175,NULL,'user_login','{"email":"konstantin.shakun@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:13:49');
INSERT INTO "activity_log" VALUES(176,NULL,'profile_deleted_immediate','{"deleted_user_id":15,"email":"konstantin.shakun@kolibri-dresden.de","reason":"immediate_deletion"}',NULL,'2025-11-19 00:13:55');
INSERT INTO "activity_log" VALUES(177,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:14:41');
INSERT INTO "activity_log" VALUES(178,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 00:14:44');
INSERT INTO "activity_log" VALUES(179,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 01:16:08');
INSERT INTO "activity_log" VALUES(180,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 01:16:13');
INSERT INTO "activity_log" VALUES(181,9,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 01:18:13');
INSERT INTO "activity_log" VALUES(182,9,'user_logout','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 01:18:19');
INSERT INTO "activity_log" VALUES(183,9,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 01:24:30');
INSERT INTO "activity_log" VALUES(184,9,'user_logout','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:a904:ea0a:b175:6be7','2025-11-19 01:24:39');
INSERT INTO "activity_log" VALUES(185,16,'user_register','{"email":"gluontevery@gmail.com","language":"de","age":55,"parental_consent_required":false}','46.211.89.114','2025-11-19 02:20:31');
INSERT INTO "activity_log" VALUES(186,16,'user_update_profile','Updated fields: first_name, last_name, birth_date, address_street, address_number, address_zip, address_city, phone, whatsapp, telegram, photo_video_consent, parental_consent, preferred_language, email',NULL,'2025-11-19 02:20:49');
INSERT INTO "activity_log" VALUES(187,16,'user_logout','{"email":"gluontevery@gmail.com"}','46.211.89.114','2025-11-19 02:20:59');
INSERT INTO "activity_log" VALUES(188,16,'user_login','{"email":"gluontevery@gmail.com"}','46.211.89.114','2025-11-19 02:21:26');
INSERT INTO "activity_log" VALUES(189,16,'user_logout','{"email":"gluontevery@gmail.com"}','46.211.89.114','2025-11-19 02:24:31');
INSERT INTO "activity_log" VALUES(190,9,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:b9a0:d720:1e7d:6908','2025-11-19 09:56:45');
INSERT INTO "activity_log" VALUES(191,9,'user_logout','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:b9a0:d720:1e7d:6908','2025-11-19 09:58:22');
INSERT INTO "activity_log" VALUES(192,9,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:b9a0:d720:1e7d:6908','2025-11-19 10:13:24');
INSERT INTO "activity_log" VALUES(193,9,'user_update_profile','Updated fields: first_name, last_name, birth_date, address_street, address_number, address_zip, address_city, phone, whatsapp, telegram, photo_video_consent, parental_consent, preferred_language, email',NULL,'2025-11-19 10:13:36');
INSERT INTO "activity_log" VALUES(194,9,'user_logout','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:b9a0:d720:1e7d:6908','2025-11-19 10:13:42');
INSERT INTO "activity_log" VALUES(195,9,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:b9a0:d720:1e7d:6908','2025-11-19 10:13:48');
INSERT INTO "activity_log" VALUES(196,9,'user_logout','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:b9a0:d720:1e7d:6908','2025-11-19 10:13:57');
INSERT INTO "activity_log" VALUES(197,9,'user_login','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-20 13:25:57');
INSERT INTO "activity_log" VALUES(198,9,'user_logout','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-20 13:29:30');
INSERT INTO "activity_log" VALUES(199,16,'user_login_failed','{"reason":"invalid_password"}','2a02:810a:8c89:4700:8969:3e1e:18e8:6d5','2025-11-22 14:29:52');
INSERT INTO "activity_log" VALUES(200,12,'user_login','{"email":"gluon2008@gmail.com"}','2a02:810a:8c89:4700:8969:3e1e:18e8:6d5','2025-11-22 14:30:50');
INSERT INTO "activity_log" VALUES(201,12,'registration_cancel','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","cancellation_reason":"User cancelled via profile"}','2a02:810a:8c89:4700:8969:3e1e:18e8:6d5','2025-11-22 14:31:27');
INSERT INTO "activity_log" VALUES(202,9,'user_login','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:d9c5:fe79:82dd:aead','2025-11-23 18:09:57');
INSERT INTO "activity_log" VALUES(203,9,'user_logout','{"email":"shks.solomon@gmail.com"}','2a02:810a:8c89:4700:d9c5:fe79:82dd:aead','2025-11-23 18:12:23');
INSERT INTO "activity_log" VALUES(204,9,'user_login','{"email":"shks.solomon@gmail.com"}','79.169.170.160','2025-11-24 04:18:49');
INSERT INTO "activity_log" VALUES(205,17,'user_register','{"email":"titiki2526@gmail.com","language":"de","age":26,"parental_consent_required":false}','81.201.155.73','2025-11-24 13:13:00');
INSERT INTO "activity_log" VALUES(206,17,'user_update_profile','Updated fields: first_name, last_name, birth_date, address_street, address_number, address_zip, address_city, phone, whatsapp, telegram, photo_video_consent, parental_consent, preferred_language, email',NULL,'2025-11-24 13:13:17');
INSERT INTO "activity_log" VALUES(207,17,'user_logout','{"email":"titiki2526@gmail.com"}','81.201.155.73','2025-11-24 13:13:34');
INSERT INTO "activity_log" VALUES(208,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:13:47');
INSERT INTO "activity_log" VALUES(209,3,'admin_add','{"targetUserId":17,"targetUserEmail":"titiki2526@gmail.com"}','81.201.155.73','2025-11-24 13:14:08');
INSERT INTO "activity_log" VALUES(210,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:14:26');
INSERT INTO "activity_log" VALUES(211,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:18:43');
INSERT INTO "activity_log" VALUES(212,18,'user_register','{"email":"ekaterina.olekh@kolibri-dresden.de","language":"de","age":47,"parental_consent_required":false}','81.201.155.73','2025-11-24 13:19:16');
INSERT INTO "activity_log" VALUES(213,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:19:30');
INSERT INTO "activity_log" VALUES(214,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:19:59');
INSERT INTO "activity_log" VALUES(215,17,'user_login','{"email":"titiki2526@gmail.com"}','81.201.155.73','2025-11-24 13:20:33');
INSERT INTO "activity_log" VALUES(216,17,'user_update_profile','Updated fields: first_name, last_name, birth_date, address_street, address_number, address_zip, address_city, phone, whatsapp, telegram, photo_video_consent, parental_consent, preferred_language, email',NULL,'2025-11-24 13:21:07');
INSERT INTO "activity_log" VALUES(217,17,'user_logout','{"email":"titoki2526@gmail.com"}','81.201.155.73','2025-11-24 13:21:46');
INSERT INTO "activity_log" VALUES(218,17,'user_login','{"email":"titoki2526@gmail.com"}','81.201.155.73','2025-11-24 13:22:13');
INSERT INTO "activity_log" VALUES(219,17,'admin_add','{"targetUserId":18,"targetUserEmail":"ekaterina.olekh@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:24:22');
INSERT INTO "activity_log" VALUES(220,17,'admin_remove','{"targetUserId":9,"targetUserEmail":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-24 13:24:32');
INSERT INTO "activity_log" VALUES(221,17,'user_login','{"email":"titoki2526@gmail.com"}','81.201.155.73','2025-11-24 13:24:40');
INSERT INTO "activity_log" VALUES(222,18,'user_logout','{"email":"ekaterina.olekh@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:26:07');
INSERT INTO "activity_log" VALUES(223,18,'user_login','{"email":"ekaterina.olekh@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:26:16');
INSERT INTO "activity_log" VALUES(224,3,'registration_create','{"event_id":5,"registration_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)"}','81.201.155.73','2025-11-24 13:27:50');
INSERT INTO "activity_log" VALUES(225,17,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-24 13:29:18');
INSERT INTO "activity_log" VALUES(226,17,'event_regenerate_qr','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","type":"telegram","regenerated":{"telegram":"https://pub-39e255af03de4d09a88851b299e3bf52.r2.dev/qr-codes/event-5-telegram.svg"},"ip":"81.201.155.73"}','81.201.155.73','2025-11-24 13:29:26');
INSERT INTO "activity_log" VALUES(227,17,'event_regenerate_qr','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","type":"telegram","regenerated":{"telegram":"https://pub-39e255af03de4d09a88851b299e3bf52.r2.dev/qr-codes/event-5-telegram.svg"},"ip":"81.201.155.73"}','81.201.155.73','2025-11-24 13:30:25');
INSERT INTO "activity_log" VALUES(228,17,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-24 13:30:36');
INSERT INTO "activity_log" VALUES(229,17,'user_logout','{"email":"titoki2526@gmail.com"}','81.201.155.73','2025-11-24 13:30:42');
INSERT INTO "activity_log" VALUES(230,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:30:55');
INSERT INTO "activity_log" VALUES(231,18,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-24 13:36:38');
INSERT INTO "activity_log" VALUES(232,18,'event_update','{"event_id":5,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)","updated_fields":["title_de","title_en","title_ru","title_uk","description_de","description_en","description_ru","description_uk","requirements_de","requirements_en","requirements_ru","requirements_uk","location_de","location_en","location_ru","location_uk","date","registration_deadline","max_participants","telegram_link","whatsapp_link"],"ip":"81.201.155.73"}','81.201.155.73','2025-11-24 13:37:05');
INSERT INTO "activity_log" VALUES(233,18,'user_logout','{"email":"ekaterina.olekh@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:37:23');
INSERT INTO "activity_log" VALUES(234,18,'user_login','{"email":"ekaterina.olekh@kolibri-dresden.de"}','81.201.155.73','2025-11-24 13:37:34');
INSERT INTO "activity_log" VALUES(235,17,'registration_create','{"event_id":5,"registration_id":6,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)"}','81.201.155.73','2025-11-24 13:37:45');
INSERT INTO "activity_log" VALUES(236,18,'registration_create','{"event_id":5,"registration_id":7,"event_title":"Exkursion zur Gläsernen Manufaktur (Dresden)"}','81.201.155.73','2025-11-24 13:38:15');
INSERT INTO "activity_log" VALUES(237,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-24 14:11:29');
INSERT INTO "activity_log" VALUES(238,9,'user_login','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-24 14:11:38');
INSERT INTO "activity_log" VALUES(239,9,'user_logout','{"email":"shks.solomon@gmail.com"}','81.201.155.73','2025-11-24 14:15:56');
INSERT INTO "activity_log" VALUES(240,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-24 14:16:04');
INSERT INTO "activity_log" VALUES(241,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','81.201.155.73','2025-11-24 14:17:13');
INSERT INTO "activity_log" VALUES(242,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','2a01:599:81a:e368:c2f2:7c1:f5a0:2288','2025-11-25 19:17:30');
INSERT INTO "activity_log" VALUES(243,3,'user_logout','{"email":"berufsorientierung@kolibri-dresden.de"}','2a01:599:81a:e368:c2f2:7c1:f5a0:2288','2025-11-25 19:22:23');
INSERT INTO "activity_log" VALUES(244,3,'user_login','{"email":"berufsorientierung@kolibri-dresden.de"}','2a01:599:81a:e368:c2f2:7c1:f5a0:2288','2025-11-25 19:22:50');
CREATE TABLE deleted_users_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    registered_at TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    events_participated TEXT -- Comma-separated list of event IDs or titles
);
INSERT INTO "deleted_users_archive" VALUES(1,'Konstantin','Shakun','2025-11-17T12:47:37','2025-11-18 15:26:02','[]');
INSERT INTO "deleted_users_archive" VALUES(2,'Anna','Malewina','2025-11-18T15:22:58','2025-11-18 16:12:10','[]');
INSERT INTO "deleted_users_archive" VALUES(3,'Hanna','Afroditova','2025-11-18T16:30:16','2025-11-18 16:40:53','[]');
INSERT INTO "deleted_users_archive" VALUES(4,'Maria','Antuanette','2025-11-18T23:45:19','2025-11-19 00:05:30','[]');
INSERT INTO "deleted_users_archive" VALUES(5,'Maia','Daineris','2025-11-19T00:12:28','2025-11-19 00:13:55','[]');
CREATE TABLE pending_deletions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
    deletion_date TEXT NOT NULL, -- Date when deletion should be executed
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "events" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Multilingual title (German is required, others optional)
    title_de TEXT NOT NULL,
    title_en TEXT,
    title_ru TEXT,
    title_uk TEXT,
    
    -- Multilingual description
    description_de TEXT,
    description_en TEXT,
    description_ru TEXT,
    description_uk TEXT,
    
    -- Multilingual requirements
    requirements_de TEXT,
    requirements_en TEXT,
    requirements_ru TEXT,
    requirements_uk TEXT,
    
    -- Multilingual location (venue/address)
    location_de TEXT,
    location_en TEXT,
    location_ru TEXT,
    location_uk TEXT,
    
    -- Event details
    date TEXT NOT NULL, -- ISO format: YYYY-MM-DDTHH:MM:SS
    max_participants INTEGER, -- NULL = unlimited participants
    registration_deadline TEXT NOT NULL, -- ISO format: YYYY-MM-DDTHH:MM:SS
    
    -- Communication channels
    telegram_link TEXT, -- Telegram group/channel link
    whatsapp_link TEXT, -- WhatsApp group link
    qr_telegram_url TEXT, -- URL to QR code in R2 storage
    qr_whatsapp_url TEXT, -- URL to QR code in R2 storage
    
    -- Status management
    status TEXT DEFAULT 'draft', -- draft/active/cancelled
    cancelled_at TEXT,
    cancellation_reason TEXT,
    
    -- Metadata
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) -- Admin who created the event
);
INSERT INTO "events" VALUES(5,'Exkursion zur Gläsernen Manufaktur (Dresden)','Excursion to the Transparent Factory Dresden','Экскурсия на Стеклянную мануфактуру Дрездена','Екскурсія до Скляної мануфактури Дрездена',replace('Blick hinter die Kulissen – Exkursion zur Gläsernen Manufaktur Dresden mit anschließendem Besuch des Dresdner Weihnachtsmarkts.\n\nWährend der Veranstaltung können Fotos und Videos aufgenommen werden. Diese Materialien werden für die Öffentlichkeitsarbeit verwendet (z. B. Website, Social Media, Printmedien). Wenn Sie mit der Veröffentlichung von Foto- und Videomaterial, auf dem Sie zu erkennen sind, einverstanden sind, setzen Sie bitte die entsprechende Markierung im Anmeldeformular.','\n',char(10)),replace('Behind the Scenes – Excursion to the Transparent Factory Dresden with subsequent visit to the Dresden Christmas Market\n\nPhotos and videos may be taken during the event. These materials are used for public relations purposes (e.g., website, social media, print media). If you agree to the publication of photo and video material in which you can be identified, please check the corresponding box in the registration form.','\n',char(10)),replace('Взгляд за кулисы – Экскурсия на Стеклянную мануфактуру Дрездена с последующим посещением Дрезденского рождественского рынка\n\nВо время мероприятия могут производиться фото- и видеосъёмка. Материалы используются для работы с общественностью (например, веб-сайт, социальные сети, печатные издания). Если Вы согласны с публикацией фото- и видеоматериалов, на которых Вы узнаваем/узнаваема, то поставьте соответствующую отметку в регистрационном формуляре.','\n',char(10)),replace('Погляд за лаштунки – Екскурсія до Скляної мануфактури Дрездена з наступним відвідуванням Дрезденського різдвяного ярмарку\n\nПід час заходу можуть проводитися фото- та відеозйомка. Матеріали використовуються для роботи з громадськістю (наприклад, веб-сайт, соціальні мережі, друковані видання). Якщо Ви згодні з публікацією фото- та відеоматеріалів, на яких Ви впізнаваний/впізнавана, то поставте відповідну позначку в реєстраційному формулярі.','\n',char(10)),'Mindesalter 17 Jahre','Minimal age is 17','Минимальный возраст - 17 лет','Учасники повинні буди не молодшими 17 років','Treff: 12:00 Uhr, Haupteingang: Die Gläserne Manufaktur, Lennéstraße 1, 01069 Dresden','Meeting point: 12:00 PM, Main entrance: The Transparent Factory, Lennéstraße 1, 01069 Dresden','Место встречи: 12:00, Главный вход: Стеклянная мануфактура, Lennéstraße 1, 01069 Дрезден','Місце зустрічі: 12:00, Головний вхід: Скляна мануфактура, Lennéstraße 1, 01069 Дрезден','2025-11-29T12:00',18,'2025-11-25T19:00','https://t.me/Berufsberatung_Sachsen',NULL,'https://pub-39e255af03de4d09a88851b299e3bf52.r2.dev/qr-codes/event-5-telegram.svg',NULL,'active',NULL,NULL,'2025-11-18T18:31:34.014Z','2025-11-24 13:37:05',3);
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('events',6);
INSERT INTO "sqlite_sequence" VALUES('users',18);
INSERT INTO "sqlite_sequence" VALUES('activity_log',244);
INSERT INTO "sqlite_sequence" VALUES('admins',4);
INSERT INTO "sqlite_sequence" VALUES('registrations',7);
INSERT INTO "sqlite_sequence" VALUES('deleted_users_archive',5);
INSERT INTO "sqlite_sequence" VALUES('event_additional_fields',4);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_event_fields_event_id ON event_additional_fields(event_id);
CREATE INDEX idx_registrations_user_id ON registrations(user_id);
CREATE INDEX idx_registrations_event_id ON registrations(event_id);
CREATE INDEX idx_registrations_event_cancelled ON registrations(event_id, cancelled_at);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp);
CREATE INDEX idx_pending_deletions_date ON pending_deletions(deletion_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_created_by ON events(created_by);
